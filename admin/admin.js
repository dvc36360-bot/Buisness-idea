
/* =========================================
   JACT MOTORCYCLE - ADMIN SYSTEM
   Supabase authentication and management
========================================= */

let jactAdmin = null;


// =========================================
// SUPABASE CLIENT
// =========================================

async function adminClient() {
  if (jactAdmin) return jactAdmin;

  jactAdmin = await getSupabase();

  return jactAdmin;
}


// =========================================
// HELPERS
// =========================================

function adminMessage(id, message, type = "success") {
  const el = document.getElementById(id);

  if (el) showStatus(el, message, type);
}

function adminEscape(value) {
  return safe(value ?? "");
}

function adminTable(content) {
  return `<div class="admin-table-scroll"><table>${content}</table></div>`;
}

function adminPage() {
  return location.pathname.split("/").pop() || "index.html";
}


// =========================================
// ADMIN AUTHENTICATION
// =========================================

async function approvedAdmin(client, userId) {
  const { data, error } = await client
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return !!data;
}


async function protectAdmin() {
  const client = await adminClient();

  const { data, error } = await client.auth.getSession();

  if (error || !data.session) {
    location.replace("login.html");
    return false;
  }

  if (!await approvedAdmin(client, data.session.user.id)) {
    await client.auth.signOut();
    location.replace("login.html");
    return false;
  }

  const email = document.getElementById("admin-email");

  if (email) {
    email.textContent = data.session.user.email || "";
  }

  return true;
}


async function loginAdmin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;

  try {
    if (button) button.disabled = true;

    const client = await adminClient();

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!await approvedAdmin(client, data.user.id)) {
      await client.auth.signOut();

      throw new Error(
        "This account has not been approved as a JACT administrator."
      );
    }

    location.href = "dashboard.html";

  } catch (err) {
    adminMessage(
      "login-message",
      err.message || "Could not sign in.",
      "error"
    );

    if (button) button.disabled = false;
  }
}


async function logoutAdmin() {
  const client = await adminClient();

  await client.auth.signOut();

  location.href = "login.html";
}


// =========================================
// DASHBOARD
// =========================================

async function loadDashboard() {
  const client = await adminClient();

  const [all, pending, confirmed, latest] = await Promise.all([

    client.from("bookings")
      .select("id", { count: "exact", head: true }),

    client.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    client.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed"),

    client.from("bookings")
      .select("customer_name,phone,service_type,bike_make,bike_model,preferred_date,status")
      .order("created_at", { ascending: false })
      .limit(8)

  ]);

  for (const result of [all, pending, confirmed, latest]) {
    if (result.error) throw result.error;
  }

  document.getElementById("stat-total").textContent =
    all.count ?? 0;

  document.getElementById("stat-pending").textContent =
    pending.count ?? 0;

  document.getElementById("stat-confirmed").textContent =
    confirmed.count ?? 0;

  const el = document.getElementById("dashboard-bookings");

  el.innerHTML = latest.data.length
    ? adminTable(
      `<thead>
        <tr>
          <th>Customer</th>
          <th>Phone</th>
          <th>Service</th>
          <th>Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${latest.data.map(b => `
          <tr>
            <td>${adminEscape(b.customer_name)}</td>
            <td>${adminEscape(b.phone)}</td>
            <td>${adminEscape(b.service_type)}</td>
            <td>${adminEscape(b.preferred_date)}</td>
            <td>${adminEscape(b.status)}</td>
          </tr>
        `).join("")}
      </tbody>`
    )
    : '<p class="muted">No booking requests yet.</p>';
}


// =========================================
// PRODUCTS
// =========================================

async function loadProducts() {
  const client = await adminClient();

  const el = document.getElementById("admin-products");

  const { data, error } = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    el.innerHTML =
      '<p class="muted">No products have been added yet.</p>';
    return;
  }

  el.innerHTML = adminTable(
    `<thead>
      <tr>
        <th>Product</th>
        <th>Price</th>
        <th>Stock</th>
        <th>Visible</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${data.map(p => `
        <tr>
          <td>
            <b>${adminEscape(p.name)}</b><br>
            <small>${adminEscape(p.description || "")}</small>
          </td>

          <td>${money(p.price)}</td>
          <td>${Number(p.stock)}</td>
          <td>${p.active ? "Yes" : "No"}</td>

          <td>
            <button
              type="button"
              class="button button-small button-ghost"
              data-edit="${p.id}">
              Edit
            </button>

            <button
              type="button"
              class="button button-small button-danger"
              data-delete="${p.id}">
              Delete
            </button>
          </td>
        </tr>
      `).join("")}
    </tbody>`
  );

  el.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      editProduct(button.dataset.edit);
    });
  });

  el.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteProduct(button.dataset.delete);
    });
  });
}


async function saveProduct(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const client = await adminClient();
  const f = form.elements;

  const id = form.dataset.editing || "";

  const item = {
    name: f.name.value.trim(),
    price: Number(f.price.value),
    stock: Number(f.stock.value),
    image_url: f.image_url.value.trim() || null,
    description: f.description.value.trim() || null,
    active: f.active ? f.active.checked : true
  };

  const result = id
    ? await client.from("products").update(item).eq("id", id)
    : await client.from("products").insert(item);

  if (result.error) throw result.error;

  form.reset();

  delete form.dataset.editing;

  const submit = form.querySelector(
    'button[type="submit"],button:not([type])'
  );

  if (submit) submit.textContent = "Add product";

  adminMessage(
    "product-message",
    id ? "Product updated." : "Product added."
  );

  await loadProducts();
}


async function editProduct(id) {
  const client = await adminClient();

  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  const form = document.getElementById("product-form");
  const f = form.elements;

  f.name.value = data.name || "";
  f.price.value = data.price;
  f.stock.value = data.stock;
  f.image_url.value = data.image_url || "";
  f.description.value = data.description || "";

  if (f.active) {
    f.active.checked = !!data.active;
  }

  form.dataset.editing = data.id;

  const submit = form.querySelector(
    'button[type="submit"],button:not([type])'
  );

  if (submit) submit.textContent = "Save changes";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  try {
    const client = await adminClient();

    const { error } = await client
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await loadProducts();

  } catch (error) {
    alert("Could not delete product: " + error.message);
  }
}


// =========================================
// BOOKINGS
// =========================================

async function loadBookings() {
  const client = await adminClient();

  const el = document.getElementById("admin-bookings");

  const { data, error } = await client
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    el.innerHTML =
      '<p class="muted">No booking requests yet.</p>';
    return;
  }

  el.innerHTML = adminTable(
    `<thead>
      <tr>
        <th>Customer / Contact</th>
        <th>Motorcycle</th>
        <th>Service / Date</th>
        <th>Details</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>

    <tbody>
      ${data.map(b => `
        <tr>

          <td>
            <b>${adminEscape(b.customer_name)}</b><br>
            ${adminEscape(b.phone)}<br>
            <small>${adminEscape(b.email || "")}</small>
          </td>

          <td>
            ${adminEscape([b.bike_make, b.bike_model].filter(Boolean).join(" ") || "Not provided")}
          </td>

          <td>
            <b>${adminEscape(b.service_type || "Not provided")}</b><br>
            ${adminEscape(b.preferred_date)}<br>
            <small>${adminEscape(b.preferred_time || "Flexible")}</small>
          </td>

          <td>
            ${adminEscape(b.details)}<br>
            <small>${adminEscape(b.location || "")}</small>
          </td>

          <td>
            <select data-booking-status="${b.id}">
              <option value="pending" ${b.status === "pending" ? "selected" : ""}>Pending</option>
              <option value="confirmed" ${b.status === "confirmed" ? "selected" : ""}>Confirmed</option>
              <option value="completed" ${b.status === "completed" ? "selected" : ""}>Completed</option>
              <option value="cancelled" ${b.status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </td>

          <td>
            <button
              type="button"
              class="button button-small button-primary"
              data-save-booking="${b.id}">
              Save
            </button>

            <button
              type="button"
              class="button button-small button-danger"
              data-delete-booking="${b.id}">
              Delete
            </button>
          </td>

        </tr>
      `).join("")}
    </tbody>`
  );

  el.querySelectorAll("[data-save-booking]").forEach(button => {
    button.addEventListener("click", () => {
      updateBooking(button.dataset.saveBooking);
    });
  });

  el.querySelectorAll("[data-delete-booking]").forEach(button => {
    button.addEventListener("click", () => {
      deleteBooking(button.dataset.deleteBooking);
    });
  });
}


async function updateBooking(id) {
  try {
    const client = await adminClient();

    const selector = document.querySelector(
      `[data-booking-status="${id}"]`
    );

    if (!selector) return;

    const { error } = await client
      .from("bookings")
      .update({ status: selector.value })
      .eq("id", id);

    if (error) throw error;

    await loadBookings();

  } catch (error) {
    alert("Could not update booking: " + error.message);
  }
}


async function deleteBooking(id) {
  if (!confirm(
    "Are you sure you want to permanently delete this booking?"
  )) return;

  try {
    const client = await adminClient();

    const { error } = await client
      .from("bookings")
      .delete()
      .eq("id", id);

    if (error) throw error;

    alert("Booking deleted successfully!");

    await loadBookings();

  } catch (error) {
    alert("Could not delete booking: " + error.message);
  }
}


// =========================================
// ORDERS
// =========================================

async function loadOrders() {
  const client = await adminClient();

  const el = document.getElementById("admin-orders");

  const { data, error } = await client
    .from("orders")
    .select("*,order_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    el.innerHTML =
      '<p class="muted">No order enquiries yet.</p>';
    return;
  }

  el.innerHTML = adminTable(
    `<thead>
      <tr>
        <th>Customer</th>
        <th>Items</th>
        <th>Total</th>
        <th>Notes</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>

    <tbody>
      ${data.map(o => `
        <tr>
          <td>
            <b>${adminEscape(o.customer_name)}</b><br>
            ${adminEscape(o.customer_phone)}<br>
            <small>${new Date(o.created_at).toLocaleString()}</small>
          </td>

          <td>
            ${(o.order_items || []).map(i =>
              `${adminEscape(i.product_name)} × ${Number(i.quantity)}`
            ).join("<br>")}
          </td>

          <td>${money(o.total)}</td>

          <td>${adminEscape(o.notes || "")}</td>

          <td>
            <select data-order-status="${o.id}">
              <option value="new" ${o.status === "new" ? "selected" : ""}>New</option>
              <option value="paid" ${o.status === "paid" ? "selected" : ""}>Paid</option>
              <option value="in_progress" ${o.status === "in_progress" ? "selected" : ""}>In progress</option>
              <option value="canceled" ${o.status === "canceled" ? "selected" : ""}>Canceled</option>
              ${["contacted","completed","cancelled"].includes(o.status) ? `<option value="${o.status}" selected>${o.status}</option>` : ""}
            </select>
          </td>

          <td>
            <button
              type="button"
              class="button button-small button-primary"
              data-save-order="${o.id}">
              Save
            </button>

            <button
              type="button"
              class="button button-small button-danger"
              data-delete-order="${o.id}">
              Delete
            </button>
          </td>
        </tr>
      `).join("")}
    </tbody>`
  );

  el.querySelectorAll("[data-save-order]").forEach(button => {
    button.addEventListener("click", () => {
      updateOrder(button.dataset.saveOrder);
    });
  });

  el.querySelectorAll("[data-delete-order]").forEach(button => {
    button.addEventListener("click", () => {
      deleteOrder(button.dataset.deleteOrder);
    });
  });
}


async function updateOrder(id) {
  try {
    const client = await adminClient();

    const selector = document.querySelector(
      `[data-order-status="${id}"]`
    );

    if (!selector) return;

    const { error } = await client
      .from("orders")
      .update({ status: selector.value })
      .eq("id", id);

    if (error) throw error;

    await loadOrders();

  } catch (error) {
    alert("Could not update order: " + error.message);
  }
}


// =========================================
// DELETE ORDER + ORDER ITEMS
// =========================================

async function deleteOrder(id) {
  const confirmed = confirm(
    "Are you sure you want to permanently delete this order and its items?"
  );

  if (!confirmed) return;

  try {
    const client = await adminClient();

    // First delete the related order items
    const { error: itemsError } = await client
      .from("order_items")
      .delete()
      .eq("order_id", id);

    if (itemsError) throw itemsError;

    // Then delete the main order
    const { error: orderError } = await client
      .from("orders")
      .delete()
      .eq("id", id);

    if (orderError) throw orderError;

    alert("Order deleted successfully!");

    await loadOrders();

  } catch (error) {
    alert("Could not delete order: " + error.message);
  }
}


// =========================================
// PAGE INITIALISATION
// =========================================

document.addEventListener("DOMContentLoaded", async () => {

  const page = adminPage();

  // LOGIN PAGE
  if (page === "login.html") {
    document
      .getElementById("login-form")
      ?.addEventListener("submit", loginAdmin);

    return;
  }

  // PROTECTED ADMIN PAGES
  if (document.body.dataset.protected !== "yes") return;

  try {

    if (!await protectAdmin()) return;

    // Add the opt-in push button only after the admin session is verified.
    if (typeof window.enableJactAdminPush === "function") {
      window.enableJactAdminPush();
    }

    document
      .getElementById("logout-btn")
      ?.addEventListener("click", logoutAdmin);


    // DASHBOARD
    if (page === "dashboard.html") {
      await loadDashboard();
    }


    // PRODUCTS
    if (page === "products.html") {

      document
        .getElementById("product-form")
        ?.addEventListener("submit", async event => {

          try {
            await saveProduct(event);

          } catch (err) {
            adminMessage(
              "product-message",
              err.message,
              "error"
            );
          }

        });

      await loadProducts();
    }


    // BOOKINGS
    if (page === "bookings.html") {
      await loadBookings();
    }


    // ORDERS
    if (page === "orders.html") {
      await loadOrders();
    }

  } catch (err) {
    console.error(err);

    alert(
      "Admin page error: " + (err.message || err)
    );
  }

});
