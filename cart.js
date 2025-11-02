// Centralized cart logic for Lamar Phone And Gadget
const CART_KEY = 'lmg_cart_v1';
window.simpleCart = window.simpleCart || { items: [] };

function formatPrice(p){ try { return '₦' + Number(p).toLocaleString(); } catch(e){ return p; } }

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(it => {
      // normalize
      return Object.assign({ qty: Number(it.qty) || 1, variant: it.variant || '' }, it);
    });
  } catch (e) { return []; }
}

// Try to locate a product image on the page when a cart item lacks one.
// Searches by data-id first, then by matching name text. Returns empty string when none found.
function findImageForProduct(prod){
  try{
    if(!prod) return '';
    // try by id attribute
    if(prod.id){
      const sel = `[data-id="${prod.id}"]`;
      const el = document.querySelector(sel);
      if(el){
        const img = (function(){
          const i = el.querySelector('img, picture source, image');
          if(i){
            if(i.tagName && i.tagName.toLowerCase() === 'source') return i.getAttribute('srcset') || i.getAttribute('data-src') || '';
            return i.getAttribute('src') || i.getAttribute('data-src') || i.getAttribute('data-image') || '';
          }
          // try background images on element or descendants
          const thumb = el.querySelector('[style*="background-image"], .thumb, .product-thumb');
          if(thumb){
            const bg = (thumb.style && thumb.style.backgroundImage) || window.getComputedStyle(thumb).backgroundImage;
            const m = String(bg||'').match(/url\((?:['\"]?)(.+?)(?:['\"]?)\)/);
            if(m && m[1]) return m[1];
          }
          return '';
        })();
        if(img) return img;
      }
    }

    // try by name text: scan common title selectors for a matching product name
    if(prod.name){
      const name = String(prod.name).trim().toLowerCase();
      const candidates = document.querySelectorAll('[data-name], .product-card, .card, article, li, div');
      for(const c of candidates){
        try{
          const title = (c.getAttribute('data-name') || (c.querySelector && (c.querySelector('.card-title, .product-title, h3, h2, .title') && c.querySelector('.card-title, .product-title, h3, h2, .title').textContent))) || '';
          if(!title) continue;
          if(String(title).trim().toLowerCase().indexOf(name) === -1) continue;
          const imgEl = c.querySelector && (c.querySelector('img, picture source') );
          if(imgEl){
            if(imgEl.tagName && imgEl.tagName.toLowerCase() === 'source') return imgEl.getAttribute('srcset') || imgEl.getAttribute('data-src') || '';
            return imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-image') || '';
          }
          const thumb = c.querySelector && (c.querySelector('.thumb, .product-thumb') );
          if(thumb){
            const bg = (thumb.style && thumb.style.backgroundImage) || window.getComputedStyle(thumb).backgroundImage;
            const m = String(bg||'').match(/url\((?:['\"]?)(.+?)(?:['\"]?)\)/);
            if(m && m[1]) return m[1];
          }
        }catch(e){ /* ignore per-item errors */ }
      }
    }
  }catch(e){}
  return '';
}

function saveCartToStorage() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(window.simpleCart.items || []));
        // notify other scripts/pages to update immediately
        try { window.dispatchEvent(new Event('cart:updated')); } catch(e) {}
      } catch(e){}
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const count = (window.simpleCart.items || []).reduce((s,i)=>s+(Number(i.qty)||0),0);
  if (badge) { badge.textContent = count; badge.style.display = count>0 ? 'inline-block' : 'none'; }
}

function addToCart(prod) {
  if (!prod) return;
  // ensure image_url exists where possible (helps programmatic calls)
  try{
    // If the product uses array-backed image fields (common in product3/product2), prefer those first
    if (!prod.image_url || String(prod.image_url).trim() === ''){
      if (Array.isArray(prod.images) && prod.images.length) {
        prod.image_url = prod.images[0];
      } else if (Array.isArray(prod.image_urls) && prod.image_urls.length) {
        prod.image_url = prod.image_urls[0];
      } else if (Array.isArray(prod.photos) && prod.photos.length) {
        prod.image_url = prod.photos[0];
      } else if (prod.photo) {
        prod.image_url = prod.photo;
      } else {
        const found = findImageForProduct(prod) || '';
        if(found) {
          // pick first url if srcset-like
          prod.image_url = (String(found).indexOf(',')>-1) ? String(found).split(',')[0].trim().split(' ')[0].trim() : found;
        }
      }
      // If still not a string URL, try to parse JSON-like image containers
      if ((!prod.image_url || String(prod.image_url).trim() === '') && prod.image_urls && typeof prod.image_urls === 'string') {
        try {
          const parsed = JSON.parse(prod.image_urls);
          if (Array.isArray(parsed) && parsed.length) prod.image_url = parsed[0];
        } catch(e){}
      }
      if ((!prod.image_url || String(prod.image_url).trim() === '') && prod.images && typeof prod.images === 'string') {
        try {
          const parsed = JSON.parse(prod.images);
          if (Array.isArray(parsed) && parsed.length) prod.image_url = parsed[0];
        } catch(e){}
      }
      if ((!prod.image_url || String(prod.image_url).trim() === '') && prod.image_url && typeof prod.image_url === 'string') {
        // image_url itself might be a JSON array string like '["https://..."]'
        const s = prod.image_url.trim();
        if (s.startsWith('[') || s.startsWith('{')){
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed) && parsed.length) prod.image_url = parsed[0];
            else if (typeof parsed === 'object' && parsed !== null) {
              // object may have keys like 0 or url
              if (parsed[0]) prod.image_url = parsed[0];
              else if (parsed.url) prod.image_url = parsed.url;
            }
          } catch(e){}
        }
      }
    }
    // unwrap url(...)
    if(prod.image_url && typeof prod.image_url === 'string'){
      const m = String(prod.image_url).match(/url\((?:['"]?)(.+?)(?:['"]?)\)/);
      if(m && m[1]) prod.image_url = m[1];
    }
  }catch(e){}

  prod.qty = Number(prod.qty) || 1;
  prod.variant = prod.variant || '';
  // ensure id exists: create a deterministic id from name+variant when missing so
  // identical products can be matched and merged across page visits
  if (!prod.id) {
    try {
      const nameKey = (prod.name || '').trim().toLowerCase();
      const variantKey = (prod.variant || '').trim().toLowerCase();
      const slugName = nameKey.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      const slugVariant = variantKey.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      const slug = slugName + (slugVariant ? ('::' + slugVariant) : '');
      prod.id = 'p-' + (slug || Math.random().toString(36).slice(2,9));
    } catch (e) {
      prod.id = 'p-' + Math.random().toString(36).slice(2,9);
    }
  }

  // Find existing item by id+variant OR fallback to name+variant match (case-insensitive)
  const idx = (window.simpleCart.items || []).findIndex(i => {
    if (String(i.id) === String(prod.id) && (i.variant || '') === (prod.variant || '')) return true;
    if (prod.name && i.name) {
      const a = (i.name || '').trim().toLowerCase();
      const b = (prod.name || '').trim().toLowerCase();
      if (a === b && (i.variant || '') === (prod.variant || '')) return true;
    }
    return false;
  });
  if (idx>=0) {
    window.simpleCart.items[idx].qty = (Number(window.simpleCart.items[idx].qty)||0) + prod.qty;
    // update timestamp to mark it as recently updated
    window.simpleCart.items[idx].addedAt = Date.now();
  } else {
    const copy = Object.assign({}, prod);
    copy.addedAt = Date.now();
    window.simpleCart.items.push(copy);
  }
  saveCartToStorage();
  updateCartBadge();
  renderCartItems();
  // Show a small, non-blocking toast confirming the add. Do NOT redirect automatically.
  showCartToast(`${prod.name || 'Item'} added to cart`);
}

// Remove an item from the cart by id (removes all quantities of that id)
function removeFromCart(id) {
  if (!id) return;
  const items = window.simpleCart.items || [];
  const idx = items.findIndex(i => String(i.id) === String(id));
  if (idx >= 0) {
    items.splice(idx, 1);
    saveCartToStorage();
    updateCartBadge();
    renderCartItems();
    showCartToast('Item removed from cart');
  }
}

// Update item quantity by delta (positive or negative). Removes item if qty <= 0.
function updateItemQty(id, delta) {
  if (!id || !delta) return;
  const items = window.simpleCart.items || [];
  const idx = items.findIndex(i => String(i.id) === String(id));
  if (idx < 0) return;
  const cur = Number(items[idx].qty) || 0;
  const next = cur + Number(delta);
  if (next <= 0) {
    // remove the item
    items.splice(idx, 1);
    showCartToast('Item removed from cart');
  } else {
    items[idx].qty = next;
    showCartToast('Quantity updated');
  }
  saveCartToStorage();
  updateCartBadge();
  renderCartItems();
}

function renderCartItems(){
  const container = document.getElementById('cartItemsContainer');
  const grandEl = document.getElementById('grandTotal');
  if (!container) return;
  const items = window.simpleCart.items || [];
  if (items.length===0) { container.innerHTML = '<div class="cart-empty-box"><div class="cart-empty-ico">😕</div><div class="cart-empty">Your Cart is empty</div><div class="cart-helper">Add items to your cart to see them here</div></div>'; if (grandEl) grandEl.textContent = '₦0'; return; }

  // Sort items by addedAt descending (most recent first)
  const sorted = items.slice().sort((a,b)=>{
    const aa = Number(a.addedAt) || 0;
    const bb = Number(b.addedAt) || 0;
    return bb - aa;
  });

  // Normalize and prepare image sources for each item so templates can use a
  // single reliable property. This handles backgrounds set via inline
  // style (background-image:url(...)), image fields with multiple names,
  // and ensures a usable placeholder when nothing is available.
  function normalizeImageUrl(u){
    try{
      if (!u) return '';
      // Accept arrays by taking the first element
      if (Array.isArray(u)) u = u[0];
      // If it's an object like { url: '...' } or { src: '...' }, extract a likely field
      if (typeof u === 'object' && u !== null) {
        if (u.url) u = u.url;
        else if (u.src) u = u.src;
        else if (u.image) u = u.image;
        else if (u.path) u = u.path;
        else {
          // fallback: pick the first value present on the object
          const vals = Object.values(u);
          u = vals.length ? vals[0] : '';
        }
      }
      if (typeof u !== 'string') return '';
      let s = String(u).trim();

      // If value looks like a JSON-array or object string, try to parse and extract first element or url
      if ((s.startsWith('[') || s.startsWith('{')) ) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed) && parsed.length) {
            s = String(parsed[0]);
          } else if (typeof parsed === 'object' && parsed !== null) {
            s = String(parsed.url || parsed.src || parsed.image || Object.values(parsed)[0] || '');
          }
        } catch(e) {
          // fall back to original string
        }
      }

      // unwrap url("...") or url('...') wrappers
      const m = s.match(/url\((?:['"]?)(.+?)(?:['"]?)\)/);
      if (m && m[1]) s = m[1];
      // remove surrounding quotes
      s = s.replace(/^['"]|['"]$/g, '');
      // convert backslashes to forward slashes
      s = s.replace(/\\+/g, '/');
      // if protocol-relative //... add current protocol
      if (s.startsWith('//')) s = window.location.protocol + s;
      // Resolve relative URLs to absolute using the document base (fixes images like "assets/img.jpg")
      // Leave alone absolute URLs (http(s):, data:, protocol-relative //, or root-relative /)
      try {
        if (s && !/^(https?:|data:|\/\/|\/) /i.test(s)) {
          s = new URL(s, document.baseURI).href;
        }
      } catch (e) {
        // if URL resolution fails, keep original value
      }
      // If this is a data URL, ensure it's valid base64 data URI
      if (s.startsWith('data:')) {
        try {
          const dataMatch = s.match(/^data:([a-zA-Z0-9+/.-]+\/[a-zA-Z0-9+/.-]+)?(;base64)?,(.+)$/);
          if (!dataMatch) { console.debug('cart: rejected malformed data URI', s); return ''; }
          const isBase64 = !!dataMatch[2];
          const payload = dataMatch[3] || '';
          if (isBase64) {
            if (payload.length < 8) { console.debug('cart: rejected short base64 payload', s); return ''; }
            if (!/^[A-Za-z0-9+\-/_=\n\r]+$/.test(payload)) { console.debug('cart: rejected non-base64 payload', s); return ''; }
          } else {
            if (payload.length < 4) { console.debug('cart: rejected short data payload', s); return ''; }
          }
        } catch (e) {
          return '';
        }
      }
      // trim again
      s = s.trim();
      return s;
    } catch(e){ return ''; }
  }

  const prepared = sorted.map(it => {
    const src = normalizeImageUrl(
      it.image_url || it.image || (Array.isArray(it.image_urls) && it.image_urls[0]) || (Array.isArray(it.images) && it.images[0]) || (Array.isArray(it.photos) && it.photos[0]) || it.photo || it.img || it.thumbnail || it.thumb || it.imageUrl || it.dataImage || ''
    );
  return Object.assign({}, it, { _cart_img: src || 'assets/images/placeholder.svg' });
  });

  // Render top-three recently added as a separate section
  const topThree = prepared.slice(0,3);
  const rest = prepared.slice(3);

  let html = '';
  if (topThree.length>0) {
    html += `<div class="recently-added">
      <div class="recently-title">Recently added</div>
      ${topThree.map(it=>`
        <div class="cart-item" data-product-id="${it.id}">
          <img src="${it._cart_img}" alt="${(it.name||'Product').replace(/"/g,'') }" class="cart-item-img" onerror="this.onerror=null;this.src='assets/images/placeholder.svg'" />
          <div class="cart-item-details">
            <div class="cart-item-header">
              <div class="cart-item-name">${it.name}</div>
              <button class="cart-remove-btn" data-id="${it.id}">Remove</button>
            </div>
            <div class="cart-product-variant">${it.variant || ''}</div>
            <div class="cart-item-footer">
              <div class="qty-controls">
                <button class="qty-decrease" data-id="${it.id}">−</button>
                <div class="cart-item-qty" data-id="${it.id}">${it.qty}</div>
                <button class="qty-increase" data-id="${it.id}">+</button>
              </div>
              <div class="cart-product-price">${formatPrice((Number(it.price)||0))} x ${it.qty} <strong class="cart-line-total">= ${formatPrice((Number(it.price)||0) * (Number(it.qty)||1))}</strong></div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  // Render the rest of items (excluding the topTwo)
  html += `<div class="all-cart-items">${rest.map(it=>`
    <div class="cart-item" data-product-id="${it.id}">
  <img src="${it._cart_img}" alt="${(it.name||'Product').replace(/"/g,'') }" class="cart-item-img" onerror="this.onerror=null;this.src='assets/images/placeholder.svg'" />
      <div class="cart-item-details">
        <div class="cart-item-header">
          <div class="cart-item-name">${it.name}</div>
          <button class="cart-remove-btn" data-id="${it.id}">Remove</button>
        </div>
        <div class="cart-product-variant">${it.variant || ''}</div>
        <div class="cart-item-footer">
          <div class="qty-controls">
            <button class="qty-decrease" data-id="${it.id}">−</button>
            <div class="cart-item-qty" data-id="${it.id}">${it.qty}</div>
            <button class="qty-increase" data-id="${it.id}">+</button>
          </div>
          <div class="cart-product-price">${formatPrice((Number(it.price)||0))} x ${it.qty} <strong class="cart-line-total">= ${formatPrice((Number(it.price)||0) * (Number(it.qty)||1))}</strong></div>
        </div>
      </div>
    </div>
  `).join('')}</div>`;

  container.innerHTML = html;

  // attach remove button handlers and accessibility features
  const removeBtns = container.querySelectorAll('.cart-remove-btn');
  removeBtns.forEach(b => {
    // ensure button won't submit forms in rare cases
    b.setAttribute('type', 'button');
    // derive a friendly name for aria-label from the nearby product name
    const itemEl = b.closest('.cart-item');
    const nameEl = itemEl ? itemEl.querySelector('.cart-item-name') : null;
    const name = nameEl ? nameEl.textContent.trim() : 'item';
    b.setAttribute('aria-label', `Remove ${name} from cart`);
    b.addEventListener('click', function(e){
      const id = this.getAttribute('data-id');
      if (!id) return;
      removeFromCart(id);
    });
    // keyboard support (Enter / Space)
    b.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
    });
  });

  // attach qty control handlers with accessibility
  const incBtns = container.querySelectorAll('.qty-increase');
  const decBtns = container.querySelectorAll('.qty-decrease');
  incBtns.forEach(b => {
    b.setAttribute('type', 'button');
    const itemEl = b.closest('.cart-item');
    const nameEl = itemEl ? itemEl.querySelector('.cart-item-name') : null;
    const name = nameEl ? nameEl.textContent.trim() : 'item';
    b.setAttribute('aria-label', `Increase quantity of ${name}`);
    b.addEventListener('click', function(){ const id = this.getAttribute('data-id'); updateItemQty(id, 1); });
    b.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } });
  });
  decBtns.forEach(b => {
    b.setAttribute('type', 'button');
    const itemEl = b.closest('.cart-item');
    const nameEl = itemEl ? itemEl.querySelector('.cart-item-name') : null;
    const name = nameEl ? nameEl.textContent.trim() : 'item';
    b.setAttribute('aria-label', `Decrease quantity of ${name}`);
    b.addEventListener('click', function(){ const id = this.getAttribute('data-id'); updateItemQty(id, -1); });
    b.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } });
  });

  const total = items.reduce((s,it)=>s + (Number(it.price)||0) * (Number(it.qty)||1),0);
  if (grandEl) grandEl.textContent = formatPrice(total);
  // show/hide grand total card and enable/disable checkout
  const grandCard = document.querySelector('.grand-total-card');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (grandCard) {
    if (items.length > 0) { grandCard.classList.add('visible'); grandCard.classList.remove('hidden'); }
    else { grandCard.classList.remove('visible'); grandCard.classList.add('hidden'); }
  }
  if (checkoutBtn) {
    if (items.length > 0) { checkoutBtn.disabled = false; checkoutBtn.classList.add('active'); }
    else { checkoutBtn.disabled = true; checkoutBtn.classList.remove('active'); }
  }

  // Ensure the container is scrolled so newly rendered items are visible.
  try {
    const container = document.getElementById('cartItemsContainer');
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
  } catch(e) {}
}

// Modal open/close helpers
function openCartModal(){ const m = document.getElementById('cartModal'); if (m) { m.classList.add('open'); m.classList.add('fullscreen'); document.body.classList.add('modal-open'); } }
function closeCartModal(){ const m = document.getElementById('cartModal'); if (m) { m.classList.remove('open'); m.classList.remove('fullscreen'); document.body.classList.remove('modal-open'); } }

// Wire buttons on DOM ready (if elements exist)
document.addEventListener('DOMContentLoaded', function(){
  // load persisted items
  window.simpleCart.items = loadCartFromStorage();
  updateCartBadge(); renderCartItems();
  // Ensure there's a visible cart badge in the bottom nav if none exists
  if (!document.getElementById('cartBadge')) {
    const cartLink = document.querySelector('a[href$="cart.html"], a[href*="/cart.html"]');
    if (cartLink) {
      const span = document.createElement('span');
      span.id = 'cartBadge';
      span.textContent = '0';
        // basic styles (inline to avoid requiring CSS edits)
        // position the badge absolutely so it sits at the top-right of the cart icon
        cartLink.style.position = cartLink.style.position || 'relative';
        span.style.position = 'absolute';
        span.style.top = '6px';
        span.style.right = '14px';
        span.style.display = 'none';
        span.style.minWidth = '18px';
        span.style.height = '18px';
        span.style.lineHeight = '18px';
        span.style.padding = '0 6px';
        span.style.borderRadius = '12px';
        span.style.background = '#e53935';
        span.style.color = '#fff';
        span.style.fontSize = '12px';
        span.style.fontWeight = '600';
        span.style.textAlign = 'center';
        span.style.pointerEvents = 'none';
      cartLink.appendChild(span);
      // update once more now that badge exists
      updateCartBadge();
    }
  }
  const cartNavBtn = document.getElementById('cartNavBtn');
  if (cartNavBtn) {
    cartNavBtn.addEventListener('click', function(e){
      const href = cartNavBtn.getAttribute('href');
      const wantsModal = cartNavBtn.dataset && cartNavBtn.dataset.modal === 'true';
      // If href is present and not '#', allow normal navigation to cart page
      if (href && href.trim() !== '#' && !wantsModal) {
        // let the browser follow link
        return;
      }
      // otherwise open in-page modal
      e.preventDefault();
      openCartModal();
    });
  }
  const closeCart = document.getElementById('closeCartModal'); if (closeCart) closeCart.addEventListener('click', closeCartModal);
  // If there's a checkout button on the page, open the cart modal and show the checkout form
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function(e){
      // if button is disabled do nothing
      if (checkoutBtn.disabled) return;
      // open modal and show checkout form
      openCartModal();
      // small timeout to ensure modal content exists
      setTimeout(()=>{
        if (typeof showCartCheckoutForm === 'function') showCartCheckoutForm();
      }, 60);
    });
  }
});

// --- Toast helper ---
function ensureToastContainer(){
  let c = document.getElementById('lmg-toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'lmg-toast-container';
    // Top-center placement
    c.style.position = 'fixed';
    c.style.left = '50%';
    c.style.top = '16px';
    c.style.transform = 'translateX(-50%)';
    c.style.zIndex = '2000';
    c.style.display = 'flex';
    c.style.flexDirection = 'column';
    c.style.alignItems = 'center';
    c.style.gap = '8px';
    document.body.appendChild(c);
  }
  return c;
}

function showCartToast(message, duration=2500){
  const container = ensureToastContainer();
  const t = document.createElement('div');
  t.className = 'lmg-toast';
  t.textContent = message;
  t.style.background = 'rgba(0,0,0,0.85)';
  t.style.color = 'white';
  t.style.padding = '10px 14px';
  t.style.marginTop = '8px';
  t.style.borderRadius = '8px';
  t.style.boxShadow = '0 4px 14px rgba(0,0,0,0.25)';
  t.style.fontSize = '13px';
  t.style.opacity = '0';
  t.style.transition = 'opacity 180ms ease, transform 220ms ease';
  // Enter from top: slide down
  t.style.transform = 'translateY(-6px)';
  container.appendChild(t);
  // trigger enter
  requestAnimationFrame(()=>{ t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(()=>{
    t.style.opacity = '0'; t.style.transform = 'translateY(-6px)';
    setTimeout(()=>{ t.remove(); }, 260);
  }, duration);
}

// Expose addToCart globally for product pages
window.addToCart = addToCart;

// Delegated handler: wire .add-cart buttons to addToCart by reading nearest card data attributes
document.addEventListener('click', function(e){
  const btn = e.target.closest && e.target.closest('.add-cart');
  if (!btn) return;
  e.preventDefault();

  // Prefer semantic card containers first
  let card = btn.closest && btn.closest('.card, .ap-card, .np-card, .product-card');
  // fallback to any element that carries product data
  if (!card) card = btn.closest && btn.closest('[data-id], [data-name], [data-price]');
  if (!card) card = btn.closest && btn.closest('article, li, div');
  if (!card) return;

  // helper: read text from a selector or attribute with fallbacks
  const readAttrOrSel = (el, attr, sel) => {
    if (!el) return null;
    const a = el.getAttribute && el.getAttribute(attr);
    if (a) return a;
    const s = el.querySelector && el.querySelector(sel);
    if (s) return s.textContent || s.getAttribute('src') || null;
    return null;
  };

  const id = card.getAttribute('data-id') || null;
  const nameRaw = readAttrOrSel(card, 'data-name', '.card-title, .product-title, .card-body .card-title') || 'Product';
  const name = String(nameRaw).trim();

  const priceRaw = readAttrOrSel(card, 'data-price', '.card-price, .price, .card-body .card-price') || '';
  // strip non-digits for price parsing (allow decimal point)
  const priceClean = String(priceRaw).replace(/[^0-9\.]/g, '').trim();
  const price = priceClean ? Number(priceClean) : 0;

  // image extraction: check attributes, <img>, then .thumb background-image
  function extractImgFromCard(el){
    if(!el) return '';
    const tryList = [];
    const da = el.getAttribute && (el.getAttribute('data-image') || el.getAttribute('data-src') || el.getAttribute('data-img'));
    if (da) tryList.push(da);
    const imgElem = el.querySelector && (el.querySelector('img.product-img, img.card-img, img') );
    if (imgElem) {
      const s = imgElem.getAttribute('src') || imgElem.getAttribute('data-src');
      if (s) tryList.push(s);
    }
    const thumbEl = el.querySelector && el.querySelector('.thumb, .product-thumb');
    if (thumbEl) {
      const bg = (thumbEl.style && thumbEl.style.backgroundImage) || window.getComputedStyle(thumbEl).backgroundImage;
      if (bg) tryList.push(bg);
    }
    // fallback: look for any inline style background-image on ancestors up to 2 levels
    let p = el.parentElement; let depth = 0;
    while(p && depth < 3){
      const bg = (p.style && p.style.backgroundImage) || window.getComputedStyle(p).backgroundImage;
      if (bg && bg !== 'none') tryList.push(bg);
      p = p.parentElement; depth++;
    }

    for (let s of tryList) {
      if (!s) continue;
      try {
        const m = String(s).match(/url\((?:['\"]?)(.+?)(?:['\"]?)\)/);
        if (m && m[1]) return m[1];
      } catch(e){}
      return s;
    }
    return '';
  }

  const image = extractImgFromCard(card) || '';

  // prefer a found image; if none, try a page-wide lookup helper
  let finalImage = image || '';
  if(!finalImage) finalImage = findImageForProduct({ id, name });

  // normalize srcset entries (pick first url if comma-separated)
  if(finalImage && finalImage.indexOf(',')>-1){
    finalImage = finalImage.split(',')[0].trim().split(' ')[0].trim();
  }

  const prod = { id, name, price: price, image_url: finalImage || '', qty: 1 };
  // If any critical field is missing, attempt an aggressive fallback lookup
  function parsePriceFromText(t){
    if (!t) return 0;
    try { const s = String(t).replace(/[^0-9\.]/g,''); return s ? Number(s) : 0; } catch(e){ return 0; }
  }

  function augmentFromCard(prod, card){
    try {
      if ((!prod.name || prod.name === 'Product') && card) {
        const titleSel = card.querySelector('.card-title, .product-title, h3, h2, .title');
        if (titleSel && titleSel.textContent.trim()) prod.name = titleSel.textContent.trim();
      }
      if ((!prod.price || prod.price === 0) && card) {
        const priceSel = card.querySelector('.card-price, .price, .amount');
        if (priceSel && priceSel.textContent) prod.price = parsePriceFromText(priceSel.textContent);
      }
      if ((!prod.image_url || prod.image_url === '') && card) {
        // look for img elements
        const img = card.querySelector('img.product-img, img.card-img, img');
        if (img && img.getAttribute('src')) prod.image_url = img.getAttribute('src');
        // check data-image attribute
        if ((!prod.image_url || prod.image_url === '') && card.getAttribute) {
          const di = card.getAttribute('data-image') || card.getAttribute('data-src');
          if (di) prod.image_url = di;
        }
        // check .thumb background
        if ((!prod.image_url || prod.image_url === '') ){
          const thumb = card.querySelector('.thumb, .product-thumb');
          if (thumb) {
            const bg = (thumb.style && thumb.style.backgroundImage) || window.getComputedStyle(thumb).backgroundImage;
            if (bg && bg !== 'none'){
              const m = String(bg).match(/url\((?:['\"]?)(.+?)(?:['\"]?)\)/);
              if (m && m[1]) prod.image_url = m[1];
            }
          }
        }
      }
    } catch(e){ /* ignore */ }
  }

  // try augmenting from the clicked card first
  augmentFromCard(prod, card);
  // as a last resort, if we have an id but still lack image/name/price, search document for matching data-id elements
  if (((!prod.image_url || prod.image_url==='') || (!prod.name || prod.name==='Product') || (!prod.price)) && prod.id) {
    try {
      const selector = `[data-id="${prod.id}"]`;
      const other = document.querySelector(selector);
      if (other && other !== card) augmentFromCard(prod, other);
    } catch(e){}
  }

  // final sane defaults
  if (!prod.name) prod.name = 'Product';
  if (!prod.image_url) prod.image_url = 'assets/images/placeholder.svg';
  if (!prod.price) prod.price = Number(prod.price) || 0;

  try { console.debug('[add-cart] adding', { id: prod.id, name: prod.name, price: prod.price, image_url: prod.image_url }); addToCart(prod); } catch(err){ console.error('add-cart handler error', err); }
});
