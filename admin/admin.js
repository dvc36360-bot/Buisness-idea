
/* JACT Motorcycle admin logic.
   Supabase RLS is the database security boundary.
*/

let jactAdmin = null;

async function adminClient() {
  if (jactAdmin) return jactAdmin;

  jactAdmin = await getSupabase();

  return jactAdmin;
}

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


// ADMIN AUTHENTICATION

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


// DASHBOARD

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
      .select("customer_name,phone,service,preferred_date,status")
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
            <td>${adminEscape(b.service)}</td>
            <td>${adminEscape(b.preferred_date)}</td>
            <td>${adminEscape(b.status)}</td>
          </tr>
        `).join("")}
      </tbody>`
    )
    : '<p class="muted">No booking requests yet.</p>';
}


// PRODUCTS

async function loadProducts() {
  const client = await adminClient();

  const el = document.getElementById("admin-products");

  const { data, error } = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    el.innerHTML = '<p class="muted">No products have been added yet.</p>';
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

  const client = await adminClient();

  const { error } = await client
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
  } else {
    await loadProducts();
  }
}


// BOOKINGS

async function loadBookings() {
  const client = await adminClient();

  const el = document.getElementById("admin-bookings");

  const { data, error } = await client
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    el.innerHTML = '<p class="muted">No booking requests yet.</p>';
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
            ${adminEscape(b.motorcycle || "Not provided")}
          </td>

          <td>
            <b>${adminEscape(b.service || "Not provided")}</b><br>
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
  const confirmed = confirm(
    "Are you sure you want to permanently delete this booking?"
  );

  if (!confirmed) return;

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


// ORDERS

async function loadOrders() {
  const client = await adminClient();

  const el = document.getElementById("admin-orders");

  const { data, error } = await client
    .from("orders")
    .select("*,order_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    el.innerHTML = '<p class="muted">No order enquiries yet.</p>';
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
        <th>Save</th>
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
              <option value="contacted" ${o.status === "contacted" ? "selected" : ""}>Contacted</option>
              <option value="completed" ${o.status === "completed" ? "selected" : ""}>Completed</option>
              <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </td>

          <td>
            <button
              type="button"
              class="button button-small button-primary"
              data-save-order="${o.id}">
              Save
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
}

async function updateOrder(id) {
  const client = await adminClient();

  const value = document.querySelector(
    `[data-order-status="${id}"]`
  ).value;

  const { error } = await client
    .from("orders")
    .update({ status: value })
    .eq("id", id);

  if (error) {
    alert(error.message);
  } else {
    await loadOrders();
  }
}


// PAGE INITIALISATION

document.addEventListener("DOMContentLoaded", async () => {

  const page = adminPage();

  if (page === "login.html") {
    document
      .getElementById("login-form")
      ?.addEventListener("submit", loginAdmin);

    return;
  }

  if (document.body.dataset.protected !== "yes") return;

  try {

    if (!await protectAdmin()) return;

    document
      .getElementById("logout-btn")
      ?.addEventListener("click", logoutAdmin);

    if (page === "dashboard.html") {
      await loadDashboard();
    }

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

    if (page === "bookings.html") {
      await loadBookings();
    }

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
