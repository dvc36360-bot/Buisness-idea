/* Public spare-parts catalogue and enquiry basket. */
let products = [];
let cart = [];

const list = document.getElementById("productList");

function renderProducts() {
  if (!list) return;
  const q = (document.getElementById("searchParts")?.value || "").toLowerCase();
  const filtered = products.filter(p =>
    (p.name + " " + (p.description || "")).toLowerCase().includes(q)
  );

  list.innerHTML = filtered.length
    ? filtered.map(p => `
      <article class="card">
        <div class="product-image">
          ${p.image_url
            ? `<img src="${safe(p.image_url)}" alt="${safe(p.name)}" loading="lazy">`
            : '<span class="placeholder">🏍</span>'}
        </div>
        <div class="product-info">
          <h3>${safe(p.name)}</h3>
          <p class="muted">${safe(p.description || "Contact JACT for details.")}</p>
          <p class="price">${money(p.price)}</p>
          <p class="muted">${Number(p.stock) > 0
            ? `${Number(p.stock)} in stock`
            : "Contact to confirm availability"}</p>
          <div class="product-actions">
            <input class="qty" type="number" min="1" max="99" value="1"
              aria-label="Quantity for ${safe(p.name)}" id="qty-${p.id}">
            <button class="btn btn-primary btn-small" type="button"
              data-add-cart="${p.id}">Add to enquiry</button>
          </div>
        </div>
      </article>`).join("")
    : '<div class="empty">No parts found. Contact JACT to ask about a part.</div>';

  list.querySelectorAll("[data-add-cart]").forEach(button => {
    button.addEventListener("click", () => addCart(button.dataset.addCart));
  });
}

function addCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const input = document.getElementById("qty-" + id);
  const quantity = Math.min(99, Math.max(1, Number(input?.value) || 1));
  const existing = cart.find(x => x.id === id);
  if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
  else cart.push({ id: p.id, name: p.name, price: Number(p.price), quantity });
  renderCart();
}

function removeCart(id) {
  cart = cart.filter(x => x.id !== id);
  renderCart();
}

function renderCart() {
  const el = document.getElementById("cartItems");
  if (!el) return;
  if (!cart.length) {
    el.textContent = "Your basket is empty.";
    return;
  }

  el.innerHTML = cart.map(x => `
    <div class="cart-row">
      <div><b>${safe(x.name)}</b><div class="muted">${x.quantity} × ${money(x.price)}</div></div>
      <div><b>${money(x.quantity * x.price)}</b>
        <button class="btn btn-small danger" type="button" data-remove-cart="${x.id}">Remove</button>
      </div>
    </div>`).join("") +
    `<p style="text-align:right"><b>Estimated total: ${money(
      cart.reduce((sum, x) => sum + x.price * x.quantity, 0)
    )}</b></p>`;

  el.querySelectorAll("[data-remove-cart]").forEach(button => {
    button.addEventListener("click", () => removeCart(button.dataset.removeCart));
  });
}

async function loadProducts() {
  if (!list) return;
  try {
    const sb = await getSupabase();
    // Public page reads only active products; it never queries admin_users.
    const { data, error } = await sb.from("products")
      .select("id,name,description,price,image_url,stock")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    products = data || [];
    renderProducts();
  } catch (error) {
    list.innerHTML = `<div class="empty">${safe(error.message)}
      <br><br>Check that Supabase is configured and the public active-products policy is enabled.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchParts")?.addEventListener("input", renderProducts);
  document.getElementById("submitOrder")?.addEventListener("click", submitOrder);
  loadProducts();
});

async function submitOrder() {
  const status = document.getElementById("orderStatus");
  const button = document.getElementById("submitOrder");
  const name = document.getElementById("buyerName")?.value.trim() || "";
  const phone = document.getElementById("buyerPhone")?.value.trim() || "";
  const notes = document.getElementById("buyerNotes")?.value.trim() || "";

  if (!cart.length) return showStatus(status, "Add at least one part to your enquiry basket.", "error");
  if (!name || !phone) return showStatus(status, "Please enter your name and phone number.", "error");

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }
    const sb = await getSupabase();

    // Server-side RPC reads current product prices and calculates the total.
    // This avoids exposing customer orders through a public SELECT policy.
    const { data, error } = await sb.rpc("create_public_order", {
      p_customer_name: name,
      p_customer_phone: phone,
      p_notes: notes || null,
      p_items: cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity
      }))
    });

    if (error) throw error;
    if (!data) throw new Error("The order was not confirmed by the database.");

    showStatus(status, "Order enquiry sent. JACT will contact you to confirm stock and arrangements.");
    cart = [];
    renderCart();
    document.getElementById("buyerName").value = "";
    document.getElementById("buyerPhone").value = "";
    document.getElementById("buyerNotes").value = "";
  } catch (error) {
    showStatus(status, error.message || "Could not send the order enquiry.", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Send order enquiry";
    }
  }
}
