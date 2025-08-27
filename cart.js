// ======= Catalog (update titles/prices/images here) =======
const RW_PRODUCTS = {
  "GoldenManHF": {
    id: "GoldenManHF",
    name: "Manzanita Hollow Form — Golden Epoxy",
    price: 45000,
    img: "/Images/Gallery/GoldenManHF/GoldenManHF-1.jpg"
  },
  "SegmentBocoteBowl": {
    id: "SegmentBocoteBowl",
    name: "Segment Bocote Bowl",
    price: 35000, // updated to $350
    img: "/Images/Gallery/SegmentBocoteBowl/SegmentBocoteBowl-1.jpg"
  },
  "CherryBurlGoblet": {
    id: "CherryBurlGoblet",
    name: "Cherry Burl Goblet",
    price: 26000,
    img: "/Images/Gallery/CherryBurlGoblet/CherryBurlGoblet-1.jpg"
  }
};

// ======= LocalStorage keys (bump versions if schema changes) =======
const RW_CART_KEY  = "rw_cart_v4";
const RW_STOCK_KEY = "rw_stock_v2";

// ======= Helpers =======
const $$ = (s) => document.querySelector(s);

function rwLoadCart(){ try { return JSON.parse(localStorage.getItem(RW_CART_KEY)) || []; } catch { return []; } }
function rwSaveCart(cart){ localStorage.setItem(RW_CART_KEY, JSON.stringify(cart)); rwRenderCart(); rwUpdateHeaderCount(); }

function rwDefaultStock(){
  // Default: 1 each (one-of-a-kind), but Cherry Burl Goblet is SOLD now.
  const s = {};
  Object.keys(RW_PRODUCTS).forEach(id => { s[id] = 1; });
  s["CherryBurlGoblet"] = 0; // SOLD by default
  return s;
}
function rwLoadStock(){
  let s;
  try { s = JSON.parse(localStorage.getItem(RW_STOCK_KEY)); } catch {}
  if (!s || typeof s !== 'object') {
    s = rwDefaultStock();
    localStorage.setItem(RW_STOCK_KEY, JSON.stringify(s));
  } else {
    // ensure Cherry remains SOLD by default
    if (typeof s["CherryBurlGoblet"] === "undefined" || s["CherryBurlGoblet"] !== 0) {
      s["CherryBurlGoblet"] = 0;
      localStorage.setItem(RW_STOCK_KEY, JSON.stringify(s));
    }
  }
  return s;
}
function rwSaveStock(stock){
  localStorage.setItem(RW_STOCK_KEY, JSON.stringify(stock));
  rwDisableAddedButtons();
  rwUpdateStatusBadges();
}

function rwIsSold(id){
  const stock = rwLoadStock();
  return stock[id] === 0;
}
function rwMarkSold(ids){
  const stock = rwLoadStock();
  ids.forEach(id => { if (id in stock) stock[id] = 0; });
  rwSaveStock(stock);
}

function rwAddToCart(id){
  if (!RW_PRODUCTS[id]) return;
  if (rwIsSold(id)) {
    alert("Sorry, this piece has been sold.");
    return;
  }
  const cart = rwLoadCart();
  if (!cart.includes(id)) cart.push(id);
  rwSaveCart(cart);
  rwDisableAddedButtons();
  rwOpenCart();
}
function rwRemoveFromCart(id){
  const cart = rwLoadCart().filter(x => x !== id);
  rwSaveCart(cart);
  rwDisableAddedButtons();
}

function rwCartLines(){ return rwLoadCart().map(id => RW_PRODUCTS[id]).filter(Boolean); }
function rwCartTotalCents(){ return rwCartLines().reduce((s,p)=>s+p.price, 0); }
function rwFmtUSD(c){ return new Intl.NumberFormat('en-US',{ style:'currency', currency:'USD' }).format(c/100); }

// ======= Drawer + rendering =======
let rwDrawer;
function rwOpenCart(){
  rwDrawer = rwDrawer || $$('#cartDrawer');
  if (rwDrawer){
    rwDrawer.classList.add("open");
    rwDrawer.setAttribute("aria-hidden","false");
    rwRenderCart();
  }
}
function rwCloseCart(){
  rwDrawer = rwDrawer || $$('#cartDrawer');
  if (rwDrawer){
    rwDrawer.classList.remove("open");
    rwDrawer.setAttribute("aria-hidden","true");
  }
}

function rwRenderCart(){
  const itemsDiv = $$('#cartItems'); const totalSpan = $$('#cartTotal');
  if (!itemsDiv || !totalSpan) return;

  const lines = rwCartLines();
  if (!lines.length){
    itemsDiv.innerHTML = "<p>Your cart is empty.</p>";
    totalSpan.textContent = "$0.00";
  } else {
    itemsDiv.innerHTML = lines.map(l => `
      <div class="cart-row">
        <img src="${l.img}" alt="${l.name}"/>
        <h4>${l.name}</h4>
        <button class="btn" style="padding:6px 10px" onclick="RWCart.remove('${l.id}')">Remove</button>
        <div style="font-weight:800;text-align:right">${rwFmtUSD(l.price)}</div>
      </div>
    `).join('');
    totalSpan.textContent = rwFmtUSD(rwCartTotalCents());
  }

  // PayPal buttons render fresh each time drawer opens
  const paypalDiv = $$('#paypal-button-container');
  if (paypalDiv && window.paypal){
    paypalDiv.innerHTML = "";
    window.paypal.Buttons({
      createOrder: (data, actions) => {
        const value = (rwCartTotalCents()/100).toFixed(2);
        if (value === "0.00") return;
        return actions.order.create({
          purchase_units: [{
            amount: {
              currency_code: "USD",
              value,
              breakdown: { item_total: { currency_code: "USD", value } }
            },
            items: rwCartLines().map(l => ({
              name: l.name,
              unit_amount: { currency_code: "USD", value: (l.price/100).toFixed(2) },
              quantity: "1"
            }))
          }]
        });
      },
      onApprove: (data, actions) =>
        actions.order.capture().then(details => {
          // mark purchased items as SOLD
          const purchasedIds = rwLoadCart();
          rwMarkSold(purchasedIds);
          localStorage.removeItem(RW_CART_KEY);
          rwRenderCart();
          rwDisableAddedButtons();
          alert("Thank you, " + (details.payer.name?.given_name || "collector") + "! Your order was completed.");
          rwCloseCart();
        })
    }).render('#paypal-button-container');
  }
}

function rwUpdateHeaderCount(){ const c = $$('#cartCount'); if (c) c.textContent = rwLoadCart().length; }

// ======= Button & Status states =======
function rwDisableAddedButtons(){
  const cart = rwLoadCart();
  const stock = rwLoadStock();
  document.querySelectorAll("[data-add]").forEach(btn => {
    const id = btn.dataset.add;
    if (!id) return;

    btn.classList.remove('added'); // reset style each pass

    if (stock[id] === 0) {
      btn.textContent = "Sold";
      btn.disabled = true;
      return;
    }
    if (cart.includes(id)) {
      btn.textContent = "Added to Cart";
      btn.classList.add('added');   // green style
      btn.disabled = true;
      return;
    }
    btn.textContent = "Add to Cart";
    btn.disabled = false;
  });
}

function rwUpdateStatusBadges(){
  const stock = rwLoadStock();
  document.querySelectorAll("[data-status-id]").forEach(el => {
    const id = el.getAttribute("data-status-id");
    if (!id) return;
    const sold = stock[id] === 0;
    el.textContent = sold ? "Sold" : "Available";
    el.style.color = sold ? "#a00" : "inherit";
    const addBtn = document.querySelector(`[data-add="${id}"]`);
    if (addBtn && sold) { addBtn.textContent = "Sold"; addBtn.disabled = true; addBtn.classList.remove('added'); }
  });
}

// Public API (safe for inline onclick)
window.RWCart = { add: rwAddToCart, remove: rwRemoveFromCart, open: rwOpenCart, close: rwCloseCart };

// Boot
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = $$('#headerCartBtn'); const closeBtn = $$('#closeCart');
  if (openBtn) openBtn.addEventListener('click', rwOpenCart);
  if (closeBtn)  closeBtn.addEventListener('click', rwCloseCart);

  // ?add=ID support
  const addParam = new URLSearchParams(location.search).get("add");
  if (addParam && RW_PRODUCTS[addParam]) rwAddToCart(addParam);

  rwUpdateHeaderCount();
  rwDisableAddedButtons();
  rwUpdateStatusBadges();
  rwRenderCart();
});