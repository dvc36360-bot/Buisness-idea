import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dvc36360-bot.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-jact-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;
const webhookSecret = Deno.env.get("JACT_WEBHOOK_SECRET") || "";

const adminDb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

async function getApprovedAdmin(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Sign in required.");

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Invalid admin session.");

  const { data: admin, error: adminError } = await adminDb
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !admin) throw new Error("This account is not an approved JACT administrator.");
  return userData.user;
}

async function sendToRole(role: string, payload: Record<string, unknown>, channelId?: string) {
  let query = adminDb.from("push_subscriptions").select("id,subscription,endpoint").eq("role", role);
  if (channelId) query = query.eq("channel_id", channelId);

  const { data, error } = await query;
  if (error) throw error;

  const message = JSON.stringify(payload);
  const expired: string[] = [];

  for (const row of data || []) {
    try {
      await webpush.sendNotification(row.subscription, message, { TTL: 60 * 60 });
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) expired.push(row.id);
      else console.error("Push delivery failed:", err);
    }
  }

  if (expired.length) {
    await adminDb.from("push_subscriptions").delete().in("id", expired);
  }

  return { sent: (data || []).length - expired.length, removed: expired.length };
}

function eventNotification(body: Record<string, any>) {
  const table = body.table || body.table_name;
  const eventType = String(body.type || body.eventType || "").toUpperCase();
  const record = body.record || body.new || {};
  const oldRecord = body.old_record || body.old || {};

  if (table === "bookings" && eventType.includes("INSERT")) {
    return {
      role: "admin",
      payload: {
        title: "JACT — New booking",
        body: `${record.customer_name || "A customer"} requested ${record.service_type || "a service"}.`,
        url: "/Buisness-idea/admin/bookings.html",
        tag: `booking-${record.id || Date.now()}`
      }
    };
  }

  if (table === "orders" && eventType.includes("INSERT")) {
    return {
      role: "admin",
      payload: {
        title: "JACT — New order",
        body: `New order enquiry from ${record.customer_name || "a customer"}.`,
        url: "/Buisness-idea/admin/orders.html",
        tag: `order-${record.id || Date.now()}`
      }
    };
  }

  if (table === "products") {
    const action = eventType.includes("DELETE") ? "removed" :
      eventType.includes("UPDATE") ? "updated" : "added";
    const product = record.name || oldRecord.name || "A product";
    return {
      role: "admin",
      payload: {
        title: "JACT — Product " + action,
        body: `${product} was ${action} in the catalogue.`,
        url: "/Buisness-idea/admin/products.html",
        tag: `product-${record.id || oldRecord.id || Date.now()}`
      }
    };
  }

  if (table === "chat_messages" && eventType.includes("INSERT")) {
    const sender = record.sender_type || record.sender_role || "customer";
    const channelId = record.conversation_id || record.channel_id;
    if (sender === "admin" && channelId) {
      return {
        role: "customer",
        channelId,
        payload: {
          title: "JACT Motorcycle replied",
          body: "You have a new reply in your JACT Live Chat.",
          url: "/Buisness-idea/chat.html",
          tag: `chat-${channelId}`
        }
      };
    }
    return {
      role: "admin",
      payload: {
        title: "JACT — New Live Chat message",
        body: "A customer sent a new message.",
        url: "/Buisness-idea/admin/chat.html",
        tag: `chat-${channelId || Date.now()}`
      }
    };
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    if (!supabaseUrl || !anonKey || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject) {
      throw new Error("The send-push function is missing required Supabase or VAPID secrets.");
    }

    const body = await req.json();
    const action = body.action || "test";

    if (action === "database_event") {
      const suppliedSecret = req.headers.get("x-jact-webhook-secret") || "";
      if (!webhookSecret || suppliedSecret !== webhookSecret) {
        return json({ error: "Invalid database webhook secret." }, 401);
      }

      const notification = eventNotification(body);
      if (!notification) return json({ ok: true, skipped: true, reason: "No notification rule for this event." });

      const result = await sendToRole(
        notification.role,
        notification.payload,
        notification.channelId
      );
      return json({ ok: true, ...result });
    }

    const user = await getApprovedAdmin(req);

    if (action === "subscribe") {
      if (!body.subscription?.endpoint || !body.subscription?.keys) {
        return json({ error: "A valid browser push subscription is required." }, 400);
      }

      const { error } = await adminDb.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: body.subscription.endpoint,
        subscription: body.subscription,
        role: "admin",
        channel_id: null
      }, { onConflict: "endpoint" });

      if (error) throw error;
      return json({ ok: true, message: "This admin device is registered for notifications." });
    }

    if (action === "test" || action === "send") {
      const payload = {
        title: String(body.title || "JACT Motorcycle"),
        body: String(body.body || "Push notification test."),
        url: String(body.url || "/Buisness-idea/admin/dashboard.html"),
        tag: "jact-admin-test"
      };
      const result = await sendToRole("admin", payload);
      return json({ ok: true, ...result });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error." }, 400);
  }
});
