# JACT Motorcycle — Upgrade Setup

The website source has been updated for the existing Supabase project. Do these steps in order.

## A. Apply the database upgrade (required)

1. Open the JACT Supabase project.
2. Open **SQL Editor** → **New query**.
3. Open `supabase/migrations/20261117_jact_upgrade.sql` from this ZIP.
4. Copy the entire SQL file into the editor and click **Run**.
5. Confirm Supabase reports success.

This aligns booking columns, updates order statuses, separates public product reads from admin access, and creates the secure `create_public_order` RPC. Do not run the same migration repeatedly unless you have checked any error first.

## B. Update the deployed `send-push` Edge Function (required)

The function currently deployed was created before the website push-registration flow was added. The ZIP now contains the matching full source at:

`supabase/functions/send-push/index.ts`

1. Supabase → **Edge Functions** → **send-push**.
2. Open `index.ts`, replace its contents with the ZIP version, then **Deploy**.
3. Keep **Verify JWT with legacy secret** OFF. The function verifies admin sessions itself and uses a separate secret for database webhooks.
4. Do not change the VAPID keys that are already saved.
5. In Edge Function Secrets, add `JACT_WEBHOOK_SECRET` with a long random value. Keep that value private; you will enter the same value in each Database Webhook header.

Required secrets are `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `JACT_WEBHOOK_SECRET`, and Supabase's built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Never place the service-role key in this website or GitHub.

## C. Create Database Webhooks for admin notifications

Create HTTP webhooks in Supabase → **Database → Webhooks**. For each webhook:

- Method: `POST`
- URL: `https://sidhbbnuflcgevoedqzc.supabase.co/functions/v1/send-push`
- Header: `Content-Type: application/json`
- Header: `x-jact-webhook-secret: YOUR_JACT_WEBHOOK_SECRET` (same value saved in Edge Function Secrets)

Create these table events:

| Table | Events | Notification |
|---|---|---|
| `bookings` | INSERT | New booking to admin |
| `orders` | INSERT | New order to admin |
| `products` | INSERT, UPDATE, DELETE | Product added/changed/deleted to admin |

The `chat_messages` event handler is prepared in the Edge Function, but Live Chat tables and customer subscription linking are a separate next upgrade; do not create that webhook until those tables exist.

## D. Publish the website files

1. Upload the updated ZIP contents to the existing GitHub repository, replacing the old website files.
2. Keep `sw.js`, `push.js`, `jact-icon.svg`, `config.js`, and `index.html` in the repository root.
3. Keep `supabase/functions/send-push/index.ts` in that exact folder structure.
4. Wait for GitHub Pages to finish publishing.
5. Sign in at `/admin/login.html`, open the dashboard, and press **Enable notifications**.
6. Allow notifications when the browser asks.

## E. Test in this order

1. Submit a test booking from the public website. It should appear in Admin → Bookings.
2. Submit a test order from Spare Parts. It should appear in Admin → Orders with the server-calculated total.
3. Add/edit/delete a test product and confirm the public catalogue updates.
4. Confirm the admin device receives the matching push notifications.

Push notifications require HTTPS, browser support, permission, and device notification settings. Android/Chrome controls sound and lock-screen display; the website cannot force those settings.
