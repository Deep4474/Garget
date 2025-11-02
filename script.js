// Safe Supabase initialization guard
// If you want the real Supabase client to be used, set these globals before
// loading this script (for example in a small `supabase-config.js` that's
// not committed to source control):
//   window.SUPABASE_URL = 'https://your-project.supabase.co';
//   window.SUPABASE_ANON_KEY = 'public-anon-key';
// Or include the Supabase JS SDK and set up `window.supabaseClient = supabase.createClient(url, key)`.
(function(){
  function nullShim(){
    return {
      // minimal shim that returns a Promise resolving to {data:[], error:null}
      from: function(){
        return {
          select: async function(){ return { data: [], error: null }; },
          insert: async function(){ return { data: [], error: null }; },
          update: async function(){ return { data: [], error: null }; },
          delete: async function(){ return { data: [], error: null }; }
        };
      },
      // auth shim (optional) used by some flows; methods return safe falsy values
      auth: { getUser: async function(){ return { data: { user: null } }; } }
    };
  }

  if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
    const url = window.SUPABASE_URL || null;
    const key = window.SUPABASE_ANON_KEY || null;
    if (url && key && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      try {
        window.supabaseClient = supabase.createClient(url, key);
      } catch (e) {
        console.warn('Could not create Supabase client, using safe shim. Error:', e);
        window.supabaseClient = nullShim();
      }
    } else if (url && key && (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function')) {
      console.warn('Supabase SDK not found. Please include @supabase/supabase-js before this script. Using safe shim.');
      window.supabaseClient = nullShim();
    } else {
      // No credentials provided — use shim and warn once
      console.warn('Supabase credentials are not set. Some features (products, categories, orders) will be disabled or return empty results. To enable, set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before this script.');
      window.supabaseClient = nullShim();
    }
  }
})();

  // Helper: check whether a real Supabase client appears to be configured
  function isSupabaseEnabled(){
    if (!window.supabaseClient) return false;
    // The shim has a from function that returns select which is async; check whether createClient exists on global supabase SDK
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) return true;
    // If the instance has a from method but also has an auth.getUser method that returns a Promise, treat it as enabled
    try{ if (typeof window.supabaseClient.from === 'function' && typeof window.supabaseClient.auth === 'object') return true; }catch(e){}
    return false;
  }

  // Developer-friendly notice (non-blocking)
  if (!isSupabaseEnabled()){
    // Use console.info to avoid being too noisy; show once
    console.info('Supabase appears not configured. To enable dynamic content from Supabase set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading scripts, or include the Supabase SDK and createClient.');
  }

  // Global image error handler
  const PLACEHOLDER_IMAGES = {
    phone: 'assets/images/smartphone.png',
    laptop: 'assets/images/laptop-thumb.png',
    tablet: 'assets/images/tablet-thumb.png',
    tv: 'assets/images/tv.png',
    accessory: 'assets/images/placeholder.svg'
  };
  
  // Function to handle image paths and fallbacks
  function getImagePath(path, category = 'accessory') {
    if (!path || path.includes('example.com')) {
      return PLACEHOLDER_IMAGES[category.toLowerCase()] || PLACEHOLDER_IMAGES.accessory;
    }
    // Remove leading slash for relative paths
    return path.startsWith('/') ? path.substring(1) : path;
  }

  document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
      console.warn('Image failed to load:', e.target.src);
      const category = e.target.getAttribute('data-category') || 'accessory';
      e.target.src = PLACEHOLDER_IMAGES[category.toLowerCase()] || PLACEHOLDER_IMAGES.accessory;
      e.target.onerror = null; // Prevent infinite loop if placeholder fails
    }
  }, true);

// Hide product section when checkout form is open
  var productsSection = document.getElementById('productsSection');
  if (productsSection) productsSection.style.display = 'none';
  // Show product section again when modal is closed
  var productsSection = document.getElementById('productsSection');
  if (productsSection) productsSection.style.display = '';
// Show the checkout form inside the cart modal when Checkout is clicked
function showCartCheckoutForm() {
  const modal = document.getElementById('cartModal');
  if (!modal) return;
  // Hide cart items and show checkout form
  // Hide cart items if present (declare only once below)

  let checkoutForm = modal.querySelector('.cart-checkout-form');
  if (!checkoutForm) {
    // Create checkout form if not present
    checkoutForm = document.createElement('form');
    checkoutForm.className = 'cart-checkout-form centered-modal-form';
  checkoutForm.innerHTML = `
      <h2>Cart Checkout</h2>
      <label for='checkoutUserName'>Name:</label>
      <input type='text' id='checkoutUserName' name='checkoutUserName' autocomplete='name' required /> <br />
      <label for='checkoutEmail'>Email:</label>
      <input type='email' id='checkoutEmail' name='checkoutEmail' autocomplete='email' required /> <br />
      <input type='tel' id='checkoutPhone' placeholder='Phone Number' required /> <br />
      <input type='text' id='checkoutAddress' placeholder='Delivery Address' required /> <br />
      <select id='checkoutPickOption' required>
        <option value=''>Pick Option</option>
        <option value='Hub to Hub'>Hub to Hub</option>
        <option value='Hub to Door'>Hub to Door</option>
      </select> <br />
      <select id='checkoutState' required>
        <option value=''>Select State</option>
        <option value='Lagos'>Lagos</option>
        <option value='Oyo'>Oyo</option>
        <option value='Abuja'>Abuja</option>
        <option value='Kano'>Kano</option>
        <option value='Rivers'>Rivers</option>
        <option value='Kaduna'>Kaduna</option>
        <option value='Enugu'>Enugu</option>
        <option value='Benue'>Benue</option>
        <option value='Edo'>Edo</option>
        <option value='Others'>Others</option>
      </select> <br />
      <button type='submit'>Place Order</button>
      <div id='cartOrderStatus' class='cart-order-status'></div>
    `;
    checkoutForm.onsubmit = async function(e) {
      e.preventDefault();
      let userName = localStorage.getItem('userName') || '';
      let userEmail = localStorage.getItem('userEmail') || '';
      if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.getUser === 'function') {
        try {
          const { data: userData } = await window.supabaseClient.auth.getUser();
          if (userData && userData.user) {
            if (!userName && userData.user.user_metadata && userData.user.user_metadata.full_name) {
              userName = userData.user.user_metadata.full_name;
            }
            if (!userEmail && userData.user.email) {
              userEmail = userData.user.email;
            }
          }
        } catch (e) {}
      }
      const nameInput = document.getElementById('checkoutUserName');
      const emailInput = document.getElementById('checkoutEmail');
      nameInput.type = 'text';
      nameInput.value = userName;
      nameInput.required = true;
      nameInput.style.display = '';
      nameInput.removeAttribute('hidden');
      emailInput.type = 'email';
      emailInput.value = userEmail;
      emailInput.required = true;
      emailInput.style.display = '';
      emailInput.removeAttribute('hidden');
      const phone = document.getElementById('checkoutPhone').value;
      const address = document.getElementById('checkoutAddress').value;
      const pickOption = document.getElementById('checkoutPickOption').value;
      const state = document.getElementById('checkoutState').value;
      userName = nameInput.value.trim();
      userEmail = emailInput.value.trim();
      if (!userName || !userEmail) {
        document.getElementById('cartOrderStatus').textContent = 'Name and email are required.';
        return;
      }
      localStorage.setItem('userName', userName);
      localStorage.setItem('userEmail', userEmail);
      const data = {
        user_name: userName,
        email: userEmail,
        phone: phone,
        address: address,
        pick_option: pickOption,
        quantity: 1,
        order_total: 1000.00,
        status: 'pending',
        delivery_option: pickOption,
        product_id: '00000000-0000-0000-0000-000000000000',
        product_name: 'Test Product',
        user_id: '00000000-0000-0000-0000-000000000000',
        state: state
      };
      console.log('Order payload:', data);
      try {
        // Use minimal returning to avoid Supabase appending a columns param which can trigger 400
        const result = await window.supabaseClient.from('orders').insert([data], { returning: 'minimal' });
        const statusElem = document.getElementById('cartOrderStatus');
        if (result && result.error) {
          console.error('Supabase insert error:', result.error, result);
          if (statusElem) statusElem.textContent = 'Error sending order: ' + (result.error.message || JSON.stringify(result.error));
        } else if (Array.isArray(result) && result[0] && result[0].error) {
          console.error('Supabase insert error (wrapped):', result[0].error, result);
          if (statusElem) statusElem.textContent = 'Error sending order.';
        } else {
          if (statusElem) statusElem.textContent = 'Order sent successfully!';
        }
      } catch (err) {
        console.error('Supabase insert threw:', err);
        document.getElementById('cartOrderStatus').textContent = 'Error connecting to Supabase: ' + (err.message || JSON.stringify(err));
      }
    };
    // Append the form directly to the cart modal content
    let cartModalContent = modal.querySelector('.cart-modal-content');
    if (cartModalContent) {
      cartModalContent.appendChild(checkoutForm);
    } else {
      modal.appendChild(checkoutForm);
    }
  }
  checkoutForm.style.display = 'block';
  // Ensure the cart modal and its content are visible
  modal.style.display = 'block';
  let cartModalContent = modal.querySelector('.cart-modal-content');
  if (cartModalContent) {
    cartModalContent.style.display = 'block';
  }
  // Optionally hide cart items if present
  let cartItems = modal.querySelector('.cart-items');
  if (cartItems) cartItems.style.display = 'none';

  // Do NOT hide the cart modal itself here. Keep it visible so the form and its fields are focusable.
}

// Restore products grid and main content when modal is closed
// Mobile checkout button event (Jumia style)
document.addEventListener('DOMContentLoaded', function() {
  var mobileCheckoutBtn = document.getElementById('mobileCheckoutBtn');
  if (mobileCheckoutBtn) {
    mobileCheckoutBtn.addEventListener('click', function() {
      showCartCheckoutForm();
      mobileCheckoutBtn.style.display = 'none';
    });
  }
  // When closing the modal, restore the checkout button
  var closeCartModalBtn = document.getElementById('closeCartModal');
  if (closeCartModalBtn) {
    closeCartModalBtn.addEventListener('click', function() {
      if (mobileCheckoutBtn) mobileCheckoutBtn.style.display = '';
    });
  }
  var closeCartModal = document.getElementById('closeCartModal');
  if (closeCartModal) {
    closeCartModal.addEventListener('click', function() {
      var productsGrid = document.getElementById('productsGrid');
      if (productsGrid) {
        productsGrid.style.display = '';
      }
      var mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.style.display = '';
      }
    });
  }
  // Ensure checkout button works even if script loads before DOM wiring elsewhere
  if (!mobileCheckoutBtn) {
    document.body.addEventListener('click', function (e) {
      const el = e.target.closest && e.target.closest('#mobileCheckoutBtn');
      if (el) {
        showCartCheckoutForm();
        el.style.display = 'none';
      }
    });
  }

/* --- SITE SEARCH: modal + Supabase-backed search with DOM fallback --- */
// Create a search modal and wire header search buttons to open it
(function(){
  function createSearchModal(){
    if (document.getElementById('siteSearchModal')) return;
    const modal = document.createElement('div');
    modal.id = 'siteSearchModal';
    modal.className = 'site-search-modal';
    modal.innerHTML = `
      <div class="site-search-backdrop" id="siteSearchBackdrop"></div>
      <div class="site-search-panel" role="dialog" aria-modal="true" aria-label="Site search">
        <div class="site-search-header">
          <input id="siteSearchInput" type="search" placeholder="Search products, phones, accessories..." aria-label="Search" />
          <button id="siteSearchClose" class="btn small">Close</button>
        </div>
        <div id="siteSearchResults" class="site-search-results">Searching...</div>
      </div>
    `;
    document.body.appendChild(modal);

    // basic styles (scoped to avoid editing CSS files)
    const style = document.createElement('style');
    style.textContent = `
      .site-search-modal { position:fixed; inset:0; z-index:13000; display:none; }
      .site-search-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.4);} 
      .site-search-panel{position:fixed;left:50%;top:8%;transform:translateX(-50%);width:92%;max-width:900px;background:#fff;border-radius:10px;padding:12px;box-shadow:0 12px 40px rgba(0,0,0,0.3);} 
      .site-search-header{display:flex;gap:8px;margin-bottom:8px;} 
      .site-search-header input{flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:6px;font-size:1rem;} 
      .site-search-results{max-height:60vh;overflow:auto;padding-top:8px;} 
      .site-search-card{display:flex;gap:12px;padding:10px;border-bottom:1px solid #f2f2f2;align-items:center;} 
      .site-search-card img{width:64px;height:64px;object-fit:contain;border-radius:8px;background:#fff} 
      .site-search-card .title{font-weight:700} 
      .site-search-empty{text-align:center;color:#666;padding:18px}
    `;
    document.head.appendChild(style);

    modal.querySelector('#siteSearchClose').addEventListener('click', closeSearch);
    modal.querySelector('#siteSearchBackdrop').addEventListener('click', closeSearch);
    modal.querySelector('#siteSearchInput').addEventListener('keydown', function(e){ if (e.key === 'Enter') { runSearch(e.target.value.trim(), 'siteSearchResults'); } });
  }

  function openSearch(){ createSearchModal(); const m=document.getElementById('siteSearchModal'); if(!m) return; m.style.display='block'; const input=document.getElementById('siteSearchInput'); if(input){ input.value=''; input.focus(); const results=document.getElementById('siteSearchResults'); if(results) results.innerHTML='Type a search and press Enter'; } }
  function closeSearch(){ const m=document.getElementById('siteSearchModal'); if(m) m.style.display='none'; }

  // Inline header search bar (mobile style) ------------------------------------------------
  function createInlineSearchBar(){
    if (document.getElementById('inlineSearchBar')) return;
    const bar = document.createElement('div');
    bar.id = 'inlineSearchBar';
    bar.className = 'inline-search-bar';
    bar.innerHTML = `
      <button id="inlineSearchBack" class="inline-back" aria-label="Back">←</button>
      <input id="inlineSearchInput" type="search" placeholder="I am shopping for..." aria-label="Search" />
      <button id="inlineSearchGo" class="inline-go" aria-label="Search">🔍</button>
      <div id="inlineSearchResults" class="inline-search-results"></div>
    `;
    // insert after the top header if present
    const header = document.querySelector('.top-compact-header') || document.querySelector('.lamar-header');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);

    const style = document.createElement('style');
    style.textContent = `
      .inline-search-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fff;border-bottom:1px solid #eee}
      .inline-search-bar .inline-back{background:none;border:none;font-size:18px}
      .inline-search-bar input{flex:1;padding:10px;border:1px solid #ddd;border-radius:20px}
      .inline-search-bar .inline-go{background:none;border:none;font-size:18px}
      .inline-search-results{position:relative;width:100%;}
      .inline-search-results .site-search-card{border-bottom:1px solid #f2f2f2}
    `;
    document.head.appendChild(style);

    document.getElementById('inlineSearchBack').addEventListener('click', closeInlineSearch);
    document.getElementById('inlineSearchGo').addEventListener('click', function(){ const q=document.getElementById('inlineSearchInput').value.trim(); runSearch(q, 'inlineSearchResults'); });
    document.getElementById('inlineSearchInput').addEventListener('keydown', function(e){ if (e.key === 'Enter') { runSearch(e.target.value.trim(), 'inlineSearchResults'); } });
  }

  function openInlineSearch(){ createInlineSearchBar(); const b=document.getElementById('inlineSearchBar'); if(!b) return; b.style.display='flex'; const input=document.getElementById('inlineSearchInput'); if(input){ input.value=''; input.focus(); const results=document.getElementById('inlineSearchResults'); if(results) results.innerHTML=''; } }
  function closeInlineSearch(){ const b=document.getElementById('inlineSearchBar'); if(b) b.style.display='none'; }

  async function runSearch(q, resultsContainerId){
    // choose results container: explicit id, or inline then modal
    let resultsEl = null;
    if (resultsContainerId) resultsEl = document.getElementById(resultsContainerId);
    if (!resultsEl) resultsEl = document.getElementById('inlineSearchResults') || document.getElementById('siteSearchResults');
    if (!resultsEl) return;
    if (!q) { resultsEl.innerHTML = '<div class="site-search-empty">Please enter a search term.</div>'; return; }
    resultsEl.innerHTML = '<div class="site-search-empty">Searching…</div>';

    // If Supabase is configured, query candidate tables
    const client = window.supabaseClient;
    const hits = [];
    try{
      if (isSupabaseEnabled() && client){
        const tables = ['product5','products','product2'];
        for (const t of tables){
          try{
            // search name, title, description fields using ilike
            const sel = await client.from(t).select('id,slug,name,title,price,image_url,description').ilike('name', `%${q}%`).limit(50);
            if (sel && !sel.error && Array.isArray(sel.data) && sel.data.length){ sel.data.forEach(r=> hits.push(Object.assign({__src:t}, r))); }
            // also search title and description if name didn't match
            const sel2 = await client.from(t).select('id,slug,name,title,price,image_url,description').ilike('title', `%${q}%`).limit(50);
            if (sel2 && !sel2.error && Array.isArray(sel2.data) && sel2.data.length){ sel2.data.forEach(r=> hits.push(Object.assign({__src:t}, r))); }
            const sel3 = await client.from(t).select('id,slug,name,title,price,image_url,description').ilike('description', `%${q}%`).limit(50);
            if (sel3 && !sel3.error && Array.isArray(sel3.data) && sel3.data.length){ sel3.data.forEach(r=> hits.push(Object.assign({__src:t}, r))); }
          }catch(e){ /* ignore table errors */ }
        }
      }
    }catch(e){ console.warn('search supabase error', e); }

    // If no supabase hits, fallback to scanning DOM for product cards (.np-card, .product-card)
    if (!hits.length){
      const cards = Array.from(document.querySelectorAll('.np-card, .product-card, .ap-card'));
      for (const c of cards){
        const name = (c.dataset && (c.dataset.name || c.dataset.title)) || (c.querySelector && (c.querySelector('.np-title') && c.querySelector('.np-title').textContent) ) || (c.querySelector && (c.querySelector('.product-title') && c.querySelector('.product-title').textContent)) || '';
        if (!name) continue;
        if (name.toLowerCase().indexOf(q.toLowerCase()) !== -1) {
          const img = c.querySelector && (c.querySelector('img') && c.querySelector('img').src) || c.dataset && c.dataset.image || '';
          const price = c.dataset && c.dataset.price || (c.querySelector && c.querySelector('.np-price') && c.querySelector('.np-price').textContent) || '';
          hits.push({ name: name.trim(), image_url: img, price: price, __src: 'dom' });
        }
      }
    }

    // Deduplicate by name+image
    const seen = new Set();
    const unique = [];
    for (const h of hits){
      const key = (h.name||h.title||h.slug||'') + '|' + (h.image_url||h.image||'');
      if (!seen.has(key)) { seen.add(key); unique.push(h); }
    }

    if (!unique.length){ resultsEl.innerHTML = '<div class="site-search-empty">No results found.</div>'; return; }

    // render results
    resultsEl.innerHTML = '';
    for (const item of unique.slice(0,50)){
      const title = item.name || item.title || item.slug || 'Product';
      const price = item.price ? (typeof item.price === 'number' ? '₦' + Number(item.price).toLocaleString() : item.price) : '';
      const img = item.image_url || item.image || (item.image_urls && item.image_urls[0]) || 'assets/images/smartphone.png';
      const link = item.slug ? `product.html?slug=${encodeURIComponent(item.slug)}` : (item.id ? `product.html?id=${encodeURIComponent(item.id)}` : '#');
      const card = document.createElement('a');
      card.href = link;
      card.className = 'site-search-card';
  card.innerHTML = `<img src="${escapeHtml(img)}" alt="" onerror="this.onerror=null;this.src='${getImagePath('assets/images/smartphone.png')}'" />` +
           `<div class="meta"><div class="title">${escapeHtml(title)}</div><div class="price">${escapeHtml(price)}</div></div>`;
      resultsEl.appendChild(card);
    }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c];}); }

  // wire header search controls
  document.addEventListener('DOMContentLoaded', function(){
    createSearchModal();
    // create inline search bar but keep hidden until used (we still create for pages that may want it)
    createInlineSearchBar();
    // NOTE: header search buttons have been removed per request. If you add a header
    // search trigger in the future, call openInlineSearch()/openSearch() programmatically.
  });

  // Header search triggers disabled: no delegated click handler is added so clicking
  // header search icons will no longer open the site search modal. To re-enable,
  // restore a delegated handler that calls openInlineSearch()/openSearch().

  // expose for debugging
  window.openSiteSearch = openSearch;
  window.runSiteSearch = runSearch;
  window.closeSiteSearch = closeSearch;
})();

  // Close cart modal: hide modal and restore body scroll
  var closeBtn = document.getElementById('closeCartModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      var modal = document.getElementById('cartModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      var mobileBtn = document.getElementById('mobileCheckoutBtn');
      if (mobileBtn) mobileBtn.style.display = '';
    });
  }

  // Always show products grid and main content on page load
  var productsGrid = document.getElementById('productsGrid');
  if (productsGrid) {
    productsGrid.style.display = '';
  }
  var mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.style.display = '';
  }
});

// Capturing listener for .share-offer to always navigate to new-product.html
document.addEventListener('click', function(e){
  try {
    const s = e.target.closest && e.target.closest('.share-offer');
    if (!s) return;
    e.stopPropagation();
    e.preventDefault();
    window.location.href = 'new-product.html';
  } catch(err) {
    // ignore
  }
}, true);

// Touch support: first tap shows overlay (adds .touch-hover), second tap navigates
(function(){
  // Apply touch behavior to several common card types used across pages
  const CARD_SELECTOR = '.product-card, .card, .ap-card, .np-card, .product-card-clickable';
  let lastTouchedCard = null;
  let lastTouchTime = 0;

  function findCardFromEventTarget(target){
    return target && target.closest ? target.closest(CARD_SELECTOR) : null;
  }

  function clearTouchHoverAll(){
    document.querySelectorAll(CARD_SELECTOR + '.touch-hover').forEach(c => c.classList.remove('touch-hover'));
  }

  function onTouchStart(e) {
    const card = findCardFromEventTarget(e.target);
    if (!card) return;
    // if user touched an actual overlay control or addbar, ignore here (those have their handlers)
    if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar') || e.target.closest('.add-cart')) return;
    const now = Date.now();
    // if the same card was touched recently, treat as second tap and navigate
    if (lastTouchedCard === card && (now - lastTouchTime) < 800) {
      // Try to navigate using several fallbacks: explicit href, internal anchor, data attributes
      const explicitHref = card.getAttribute('data-href') || card.getAttribute('data-url') || card.getAttribute('data-link');
      if (explicitHref) { window.location.href = explicitHref; return; }
      // prefer an internal anchor if present
      const a = card.querySelector && card.querySelector('a.card-link, a[href]');
      if (a && a.getAttribute('href')) { window.location.href = a.getAttribute('href'); return; }
      const slug = card.getAttribute('data-slug') || card.getAttribute('data-product-slug') || card.getAttribute('data-product-id') || card.getAttribute('data-id');
      // If the card contains a share control, prefer the share/new-product page
      try {
        const shareBtn = card.querySelector && card.querySelector('.share-product');
        if (shareBtn) {
          let img = card.getAttribute('data-image') || '';
          if (!img) {
            const imgTag = card.querySelector && (card.querySelector('img.product-img') || card.querySelector('img'));
            if (imgTag && imgTag.src) img = imgTag.src;
          }
          try { if (img && !/^https?:\/\//i.test(img)) img = new URL(img, window.location.href).href; } catch(e) {}
          try { sessionStorage.selectedProductImageUrl = img || ''; } catch(e) {}
          const href = 'new-product.html' + (img ? ('?image_url=' + encodeURIComponent(img)) : '');
          window.location.href = href;
          return;
        }
      } catch (e) { /* ignore */ }
      if (slug) { window.location.href = 'product.html?slug=' + encodeURIComponent(slug); return; }
      // fallback: trigger the existing click flow
      card.click();
      return;
    }

    // otherwise show overlay on this card and hide previous
    clearTouchHoverAll();
    card.classList.add('touch-hover');
    lastTouchedCard = card;
    lastTouchTime = now;
  }

  // attach to the document for delegation
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  // hide touch-hover when user taps elsewhere
  document.addEventListener('touchstart', function(e){
    const card = findCardFromEventTarget(e.target);
    if (!card) clearTouchHoverAll();
  }, { passive: true });
})();
// Set the amount to pay for mobile on checkout form
document.addEventListener('DOMContentLoaded', function() {
  var amountInput = document.getElementById('amountToPay');
  if (amountInput) {
    // Example: Set mobile price, you can fetch dynamically if needed
    var mobilePrice = 50000; // Replace with actual price logic
    amountInput.value = '₦' + mobilePrice.toLocaleString();
  }
});
// productBgCarousel removed
// Live Buyer Ticker (bottom of page)
// Live Buyer Ticker now inside live advert bar
document.addEventListener('DOMContentLoaded', async function() {
  // Show a rotating live message (not from Supabase)
  const advertText = document.getElementById('liveAdvertText');
  if (!advertText) return;
  const messages = [
    'Ayo just bought iPhone 15 Pro Max!',
    'Chika just bought Samsung Galaxy S24!',
    'Emeka just bought MacBook Pro 14"!',
    'Fatima just bought Apple Magic Keyboard!',
    'Tunde just bought Samsung Galaxy Z Flip 6!',
    'Ngozi just bought Infinix Hot 40!',
    'Bola just bought Oraimo Power Bank!',
    'Ada just bought Tecno Camon 20!'
  ];
  let idx = 0;
  function showMessage(i) {
    advertText.textContent = messages[i];
  }
  showMessage(idx);
  setInterval(function() {
    idx = (idx + 1) % messages.length;
    showMessage(idx);
  }, 3500);
});

// Fetch and render Best Selling products from Supabase `product2` table
document.addEventListener('DOMContentLoaded', function() {
  const grid = document.getElementById('bestsellingGrid');
  const prevBtn = document.getElementById('bestsellingPrev');
  const nextBtn = document.getElementById('bestsellingNext');

  if (!grid) return;

  async function renderPlaceholder() {
    grid.innerHTML = '<div class="loading">Loading best selling...</div>';
  }

  async function renderError(msg) {
    grid.innerHTML = `<div class="error">${msg}</div>`;
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]+/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]); }); }

  function productCardHtml(p) {
    // Accept several common image field names and arrays
    const img = p.image_url || p.image || (p.image_urls && Array.isArray(p.image_urls) && p.image_urls[0]) || (p.images && Array.isArray(p.images) && p.images[0]) || p.photo || (p.photos && Array.isArray(p.photos) && p.photos[0]) || 'assets/images/smartphone.png';
    const name = p.name || p.title || 'Unnamed product';
    const price = (p.price || p.amount || p.product_price) ? `#${Number(p.price || p.amount || p.product_price).toLocaleString()}` : '';
    // include overlay and data attributes so add-to-cart delegation can extract product info
  const idAttr = p.id ? `data-product-id="${p.id}"` : '';
  const href = p.slug ? `product.html?slug=${encodeURIComponent(p.slug)}` : (p.id ? `product.html?id=${encodeURIComponent(p.id)}` : 'product.html');
  // If the product looks like the new special product (e.g. phone4), point to the dedicated page
  const isNewSpecial = (String(name || '').toLowerCase().indexOf('phone4') !== -1) || (String(p.slug || '').toLowerCase().indexOf('phone4') !== -1);
  const specialHref = isNewSpecial ? 'new-product.html' : href;
  const dataAttrs = `${idAttr} data-href="${specialHref}" data-name="${escapeHtml(name)}" data-price="${p.price || ''}" data-image="${escapeHtml(img)}"`;
    return `
      <article class="product-card" role="article" aria-label="${name}" ${dataAttrs}>
        <div class="product-thumb"><img src="${img}" alt="${name}"></div>
        <div class="product-title">${name}</div>
        <div class="product-price">${price}</div>
        <div class="card-overlay">
          <div class="overlay-top">
            <button class="ico-btn wish" title="Add to wishlist">♡</button>
            <button class="ico-btn compare" title="Compare">⇄</button>
          </div>
          <div class="overlay-bottom">
            <button class="add-cart">Add to cart</button>
          </div>
        </div>
      </article>
    `;
  }

  async function fetchBestselling() {
    try {
      renderPlaceholder();
      const client = window.__LAMAR_SUPABASE || window.supabaseClient || (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : (typeof createClient === 'function' ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null));
      if (!client || typeof client.from !== 'function') {
        // shim returns empty data; show friendly message
        return renderError('No Supabase client available. Best selling products are not loaded.');
      }

      // Try to get active best selling items; fallback to selecting all rows
      let res;
      try {
        // Attempt to select a common subset of fields; adjust as your schema requires
        res = await client.from('product2').select('id,name,price,image_url,created_at').order('created_at', { ascending: false }).limit(12);
      } catch (e) {
        // If that fails, try a plain select
        try {
          res = await client.from('product2').select('*').limit(12);
        } catch (err) {
          console.error('Error querying product2:', err);
          return renderError('Error loading best selling products.');
        }
      }

      if (!res) return renderError('No response from Supabase');
      if (res.error) {
        console.error('Supabase error selecting product2:', res.error);
        return renderError('Error loading best selling products: ' + (res.error.message || 'Unknown error'));
      }

      const data = Array.isArray(res.data) ? res.data : (res.data && res.data.data) || [];
      if (!data || data.length === 0) {
        return renderError('No best selling products found.');
      }

      // Debug: log returned rows and the image candidates for the first few items
      try{
        console.debug('[fetchBestselling] returned', data.length, 'items');
        (data.slice(0,5)).forEach(d => {
          console.debug('[fetchBestselling] item', d.id || '(no id)', 'candidates:', {
            image_url: d.image_url, image: d.image, image_urls0: (d.image_urls && d.image_urls[0]), images0: (d.images && d.images[0]), photo: d.photo
          });
        });
      }catch(e){}

      grid.innerHTML = data.map(d => productCardHtml(d)).join('');

    } catch (err) {
      console.error('Unexpected error fetching best selling:', err);
      renderError('Unexpected error loading best selling products.');
    }
  }

  // Wire Prev/Next to scroll the grid by card width
  function scrollGrid(dir) {
    const card = grid.querySelector('.product-card');
    const step = card ? card.offsetWidth + 12 : 180;
    grid.scrollBy({ left: dir * step, behavior: 'smooth' });
  }

  if (prevBtn) prevBtn.addEventListener('click', function() { scrollGrid(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function() { scrollGrid(1); });

  // Fetch when the element scrolls into view (lazy-load)
  const containerSection = document.querySelector('.bestselling-section');
  const revealTargets = [grid, containerSection].filter(Boolean);

  function makeVisible() {
    // add reveal class to targets
    revealTargets.forEach(t => t.classList.add('is-visible'));
  }

  if ('IntersectionObserver' in window && containerSection) {
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // fetch once and reveal
          fetchBestselling();
          makeVisible();
          o.disconnect();
        }
      });
    }, { root: null, rootMargin: '0px', threshold: 0.15 });
    obs.observe(containerSection);
  } else {
    // fallback: fetch after short delay
    setTimeout(async () => { await fetchBestselling(); makeVisible(); }, 600);
  }
});
// Global product renderer and sort handler
// This provides a fallback `window.renderProducts` so pages that set `window.products`
// (like categories.js or page scripts) can call it to render a consistent product grid.
(function(){
  function formatPrice(v){ if (v === undefined || v === null || v === '') return ''; if (typeof v === 'number') return '₦' + Number(v).toLocaleString(); return String(v); }

  function productCardHtml(p){
    const rawImg = p.image_url || p.image || (p.image_urls && Array.isArray(p.image_urls) && p.image_urls[0]) || (p.images && Array.isArray(p.images) && p.images[0]) || p.photo;
    const category = (p.category || '').toLowerCase();
    const img = getImagePath(rawImg, category);
    const name = p.name || p.title || p.product_name || 'Unnamed product';
    const price = formatPrice(p.price || p.amount || p.product_price || p.unit_price || '');
    const idAttr = p.id ? `data-product-id="${String(p.id).replace(/"/g,'') }"` : '';
    const slug = p.slug || (p.id ? String(p.id) : '');
    const href = p.slug ? `product.html?slug=${encodeURIComponent(p.slug)}` : (p.id ? `product.html?id=${encodeURIComponent(p.id)}` : '#');
    return `
      <article class="product-card" role="article" aria-label="${escapeHtml(name)}" ${idAttr} data-href="${href}" data-image="${escapeHtml(img)}">
        <div class="product-thumb"><img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" data-category="${category}"></div>
        <div class="product-title">${escapeHtml(name)}</div>
        <div class="product-price">${escapeHtml(price)}</div>
        <div class="card-overlay"><div class="overlay-top"><button class="ico-btn wish">♡</button></div><div class="overlay-bottom"><button class="add-cart">Add to cart</button></div></div>
      </article>
    `;
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  // Primary renderer: will try to render into known containers in order of preference
  window.renderProducts = function(products){
    if (!products || !Array.isArray(products)) products = window.products || [];
    // Normalize product objects (some pages provide different shapes)
    const normalized = products.map(p => {
      if (!p) return null;
      if (p._raw) return { id: p.id || p._raw.id || p._raw.product_id, name: p.name || p.title || p._raw.name || p._raw.title, price: p.price || p.amount || p._raw.price || p._raw.amount, image_url: p.image_url || p.image || (Array.isArray(p.image_urls) && p.image_urls[0]) || p._raw.image || p._raw.image_url || '', slug: p.slug || p._raw.slug || null, _raw: p._raw };
      return { id: p.id || p.product_id || null, name: p.name || p.title || '', price: p.price || p.amount || '', image_url: p.image_url || p.image || '', slug: p.slug || null, _raw: p };
    }).filter(Boolean);

    // Prefer specific page containers
    const phonesGrid = document.getElementById('phonesGrid');
    const productsGrid = document.getElementById('productsGrid');
    const allProductsContainer = document.getElementById('allProductsContainer');

    if (phonesGrid) {
      phonesGrid.innerHTML = '';
      normalized.forEach(p => {
        const el = document.createElement('article');
        el.className = 'product-card';
        const pid = p.id || (p.name && p.name.replace(/\s+/g,'-').toLowerCase()) || '';
        el.setAttribute('data-product-id', pid);
        el.setAttribute('data-slug', pid);
        const imgSrc = p.image_url || getImagePath('assets/images/smartphone.png');
        const href = p.slug ? `product.html?slug=${encodeURIComponent(p.slug)}` : (p.id ? `product.html?id=${encodeURIComponent(p.id)}` : '#');
        el.setAttribute('data-href', href);
        el.setAttribute('data-image', imgSrc);
        el.innerHTML = `
          <a class="product-link" href="${href}">
            <div class="product-overlay"><button class="icon-btn heart">❤</button></div>
            <img class="product-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name||'')}">
            <div class="product-name">${escapeHtml(p.name||'')}</div>
            <div class="price">${typeof p.price === 'number' ? '₦' + Number(p.price).toLocaleString() : escapeHtml(p.price||'')}</div>
            <div class="product-addbar" data-action="addbar"><span class="add-text">Add to cart</span></div>
          </a>
        `;
        phonesGrid.appendChild(el);
      });
      window.products = normalized;
      return;
    }

    if (productsGrid) {
      productsGrid.innerHTML = normalized.map(productCardHtml).join('');
      window.products = normalized;
      return;
    }

    if (allProductsContainer) {
      allProductsContainer.innerHTML = normalized.map(productCardHtml).join('');
      window.products = normalized;
      return;
    }

    // Fallback: try to find any container with class products-grid
    const fallback = document.querySelector('.products-grid, .products-section, .products-list');
    if (fallback) {
      fallback.innerHTML = normalized.map(productCardHtml).join('');
      window.products = normalized;
      return;
    }

    // If nowhere to render, store products on window for future use
    window.products = normalized;
  };

  // Sorting helper: listens for any select#sortSelect change and reorders window.products
  function applySortAndRerender() {
    const sel = document.getElementById('sortSelect');
    if (!sel) return;
    sel.addEventListener('change', function(){
      try {
        const val = (sel.value || (sel.options && sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text) || '').toLowerCase();
        const arr = Array.isArray(window.products) ? window.products.slice() : [];
        if (!arr.length) return;
        if (val.indexOf('price') !== -1 && val.indexOf('low') !== -1) {
          arr.sort((a,b)=> (Number(a.price)||0) - (Number(b.price)||0));
        } else if (val.indexOf('price') !== -1 && val.indexOf('high') !== -1) {
          arr.sort((a,b)=> (Number(b.price)||0) - (Number(a.price)||0));
        } else if (val.indexOf('new') !== -1 || val.indexOf('newest') !== -1 || val === 'newest' || val === 'new') {
          // try to sort by created_at in _raw if present, newest first
          arr.sort((a,b)=> {
            const da = (a._raw && (a._raw.created_at || a._raw.createdAt)) || a.created_at || a.createdAt || null;
            const db = (b._raw && (b._raw.created_at || b._raw.createdAt)) || b.created_at || b.createdAt || null;
            const ta = da ? Date.parse(da) : 0;
            const tb = db ? Date.parse(db) : 0;
            return (tb || 0) - (ta || 0);
          });
        }
        // update global and re-render
        window.products = arr;
        if (typeof window.renderProducts === 'function') window.renderProducts(arr);
      } catch (e) { console.warn('Sort handler error', e); }
    });
  }

  // attach on DOMContentLoaded to ensure select exists
  document.addEventListener('DOMContentLoaded', applySortAndRerender);
})();
// Note: top-header notification injection and delegated click-to-open behavior
// removed to keep header minimal. Bottom-nav notification links remain unchanged.
// Show the buy modal for a product (global for Buy Now button)
function openBuyModal(product) {
  const modal = document.getElementById('buyModal');
  if (!modal) return;
  // Set product info in modal
  modal.dataset.productId = product.id;
  modal.dataset.productPrice = product.price;
  modal.dataset.productName = product.name;
    const nameElem = modal.querySelector('.buy-product-name');
    const imgElem = modal.querySelector('.buy-modal-product-img');
    const details = [
      ...modal.querySelectorAll('.buy-product-category, .buy-product-description, .buy-product-stock, .buy-product-price')
    ];
  // Try to detect user name and email from Supabase auth
  if (window.supabase && supabase.auth && typeof supabase.auth.getUser === 'function') {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const nameInput = modal.querySelector('#orderUserName');
        const emailInput = modal.querySelector('#orderEmail');
        if (nameInput) nameInput.value = user.user_metadata?.full_name || user.user_metadata?.name || '';
        if (emailInput) emailInput.value = user.email || '';
      }
    });
  }
    // Update modal content
    if (nameElem) nameElem.textContent = product.name || '';
    // Show all details and product name, always show form
    if (imgElem) imgElem.style.display = '';
    details.forEach(d => d.style.display = '');
    const form = modal.querySelector('#orderForm');
    if (form) form.classList.remove('hide-buy-form');
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    // Clear previous status
    const orderStatus = document.getElementById('orderStatus');
    if (orderStatus) orderStatus.textContent = '';
    // Optionally focus first input
    const firstInput = modal.querySelector('input,select');
    if (firstInput) firstInput.focus();
  // Show modal
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  // Clear previous status
  const orderStatusModal = document.getElementById('orderStatus');
  if (orderStatusModal) orderStatusModal.textContent = '';
  // Optionally focus first input
  const firstInputModal = modal.querySelector('input,select');
  if (firstInputModal) firstInputModal.focus();
}
// Dynamically render menu categories
document.addEventListener('DOMContentLoaded', function() {
  // Show all categories at once, no see all/see less toggle
  const container = document.getElementById('menuCategoriesContainer');
  // Only render the main product categories in the drawer
  const categories = [
    { id: 'phones', name: 'Phones', icon: 'fa-mobile-alt' },
    { id: 'laptops', name: 'Laptops', icon: 'fa-laptop' },
    { id: 'accessories', name: 'Accessories', icon: 'fa-headphones' },
    { id: 'tvs', name: 'TVs', icon: 'fa-tv' }
  ];
  if (container) {
    container.innerHTML = categories.map(cat => {
      let iconHtml = '';
      if (cat.icon) {
        if (cat.icon.startsWith('fa-')) {
          iconHtml = `<i class=\"fas ${cat.icon} inline-icon\"></i>`;
        } else if (cat.icon.endsWith('.svg')) {
          iconHtml = `<img src=\"./assets/images/${cat.icon}\" alt=\"${cat.name}\" class=\"inline-icon small\" />`;
        }
      }
      return `<a href=\"#${cat.id}\" class=\"menu-link\" data-category=\"${cat.name}\">${iconHtml}${cat.name}</a>`;
    }).join('');
    // Add click event to fetch and show products for each category
    container.querySelectorAll('.menu-link').forEach(link => {
      link.addEventListener('click', async function(e) {
        // Ensure clicking a category never affects the header or live advert
        e.preventDefault();
        const category = this.getAttribute('data-category');
        if (!category) return;
        // Only update the products section, never touch header elements
        // Fetch products from Supabase filtered by category (case-insensitive)
        const { data, error } = await supabase.rpc('fetch_products_by_category', { cat: category });
        if (error) {
          alert('Error fetching products for ' + category);
          return;
        }
        renderProducts(data);
        // Optionally close the menu drawer if open
        const menuDrawer = document.getElementById('menuDrawer');
        if (menuDrawer) menuDrawer.classList.remove('open');
        document.body.classList.remove('menu-drawer-open');
        // Scroll to products section and highlight
        const productsSection = document.getElementById('productsGrid');
        if (productsSection) {
          // Get header height to offset scroll
          const header = document.querySelector('.lamar-header');
          const headerHeight = header ? header.offsetHeight : 0;
          const sectionTop = productsSection.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
          window.scrollTo({ top: sectionTop, behavior: 'smooth' });
          productsSection.classList.add('highlight-products-section');
          setTimeout(() => {
            productsSection.classList.remove('highlight-products-section');
          }, 800);
        }
        // Guard: do not modify header or live advert elements
        // (No code below this line should touch .lamar-header, .live-advert, or header children)
      });
    });
  }
});

// Add menu open/close logic to toggle scrollability
document.addEventListener('DOMContentLoaded', function() {
  const menuBtn = document.getElementById('menuBtn');
  let menuDrawer = document.getElementById('menuDrawer');
  let closeMenuDrawer = document.getElementById('closeMenuDrawer');

  // Helper: create a minimal menu drawer markup if the current page doesn't include it
  function createMenuDrawerIfMissing(){
    if (document.getElementById('menuDrawer')) return document.getElementById('menuDrawer');
    const d = document.createElement('div');
    d.id = 'menuDrawer';
    d.className = 'menu-drawer';
    d.innerHTML = `
      <div class="menu-drawer-content">
        <button class="close" id="closeMenuDrawer" aria-label="Close menu">&times;</button>
        <div class="account-area">
          <div class="account-circle" style="cursor: pointer" onclick="showAccountModal()" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" stroke="#777" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20c0-3.31 3.59-6 8-6s8 2.69 8 6" stroke="#777" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="account-links"><a href="#" onclick="showAccountModal(); return false;">My Account</a></div>
        </div>
        <hr class="menu-sep" />
        <nav class="menu-list">
          <a href="#home" class="menu-item active">Home</a>
          <a href="#flash" class="menu-item"><span class="menu-flag">›</span>Flash Sale</a>
          <a href="#blogs" class="menu-item">Blogs</a>
          <a href="#brands" class="menu-item">All Brands</a>
          <!-- All Categories toggle -->
          <div class="menu-categories">
            <a href="#categories" class="menu-item" id="allCategoriesToggle">All Categories <span class="toggle-arrow" aria-hidden="true">»</span></a>
            <div id="menuCategoriesContainer" class="menu-categories-list">
              <a href="#phones" class="menu-link" data-category="Phones">Phones</a>
              <a href="#laptops" class="menu-link" data-category="Laptops">Laptops</a>
              <a href="#accessories" class="menu-link" data-category="Accessories">Accessories</a>
              <a href="#tvs" class="menu-link" data-category="TVs">TVs</a>
            </div>
          </div>
        </nav>
      </div>
    `;

    // append the drawer and inject styles if not already present
    document.body.appendChild(d);
    if (!document.getElementById('menuDrawerStyles')){
      const s = document.createElement('style');
      s.id = 'menuDrawerStyles';
      s.textContent = `
        .menu-drawer{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:86%;background:#fff;box-shadow:-8px 0 30px rgba(0,0,0,0.12);transform:translateX(100%);transition:transform .28s cubic-bezier(.2,.9,.2,1);z-index:14000;overflow:auto}
        .menu-drawer.open{transform:translateX(0)}
        .menu-drawer .menu-drawer-content{padding:18px}
        .menu-drawer .close{background:none;border:none;color:#e64a19;font-size:26px;padding:6px;margin:2px 0 8px;cursor:pointer}
        .menu-drawer .account-area{display:flex;align-items:center;gap:12px;padding:6px 0}
        .menu-drawer .account-circle{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #f0f0f0;background:#fff}
        .menu-drawer .account-links{color:#666;font-size:14px}
        .menu-drawer .account-links a{color:#556;text-decoration:none;margin:0 6px}
        .menu-drawer .menu-sep{border:none;border-top:1px solid #f1f1f1;margin:10px 0}
        .menu-list{display:block;padding:6px 0}
        .menu-item{display:block;padding:14px 14px;border-radius:4px;color:#0f1724;text-decoration:none;font-weight:600;margin:6px 0}
        .menu-item.active{background:#efefef}
        .menu-item .menu-flag{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:#0fa24a;color:#fff;border-radius:50%;margin-right:10px;font-weight:700}
        @media(max-width:480px){ .menu-drawer{width:86%} .menu-item{padding:12px} }
      `;
      document.head.appendChild(s);
    }

    // wire close handler immediately
    const closeBtn = d.querySelector('#closeMenuDrawer');
    if (closeBtn) closeBtn.addEventListener('click', function(){ d.classList.remove('open'); document.body.classList.remove('menu-drawer-open'); });

    // Wire the All Categories toggle and subcategory click handlers
    const allToggle = d.querySelector('#allCategoriesToggle');
    const categoriesContainer = d.querySelector('#menuCategoriesContainer');
    if (allToggle && categoriesContainer) {
      allToggle.addEventListener('click', function(e){
        e.preventDefault();
        console.debug('[menu] allCategoriesToggle clicked (dynamic drawer)');
        // toggle visible class instead of inline styles
        const isOpen = categoriesContainer.classList.toggle('open');
        const arrow = allToggle.querySelector('.toggle-arrow');
        if (arrow) arrow.classList.toggle('toggle-rotated', isOpen);
      });

      // Add click listeners to each subcategory link to fetch products and close menu
      categoriesContainer.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', async function(e){
          e.preventDefault();
          const category = this.getAttribute('data-category');
          if (!category) return;
          // Attempt to fetch products using existing Supabase RPC if available
          try {
            if (typeof supabase !== 'undefined' && supabase.rpc) {
              const { data, error } = await supabase.rpc('fetch_products_by_category', { cat: category });
              if (error) {
                console.warn('Error fetching products for', category, error);
              } else if (data && typeof renderProducts === 'function') {
                renderProducts(data);
              }
            }
          } catch (err) { console.warn('Category fetch failed', err); }

          // Close the menu drawer
          d.classList.remove('open');
          document.body.classList.remove('menu-drawer-open');

          // Scroll to products section if present
          const productsSection = document.getElementById('productsGrid');
          if (productsSection) {
            const header = document.querySelector('.lamar-header');
            const headerHeight = header ? header.offsetHeight : 0;
            const sectionTop = productsSection.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
            window.scrollTo({ top: sectionTop, behavior: 'smooth' });
            productsSection.classList.add('highlight-products-section');
            setTimeout(() => productsSection.classList.remove('highlight-products-section'), 800);
          }
        });
      });
    }

    return d;
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function() {
      // ensure drawer exists on this page
      menuDrawer = document.getElementById('menuDrawer') || createMenuDrawerIfMissing();
      closeMenuDrawer = document.getElementById('closeMenuDrawer');
      if (!menuDrawer) return;
      menuDrawer.classList.add('open');
      document.body.classList.add('menu-drawer-open');
      // Scroll to the categories section in the menu drawer
      setTimeout(function() {
        var categoriesSection = menuDrawer.querySelector('.menu-categories');
        if (categoriesSection) {
          categoriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    });
  }
  // Auto-scroll to categories if user scrolls up inside the menu drawer
  if (menuDrawer) {
    let lastScrollTop = 0;
    menuDrawer.addEventListener('scroll', function() {
      const st = menuDrawer.scrollTop;
      // If user scrolls up (current scrollTop < lastScrollTop)
      if (st < lastScrollTop) {
        const categoriesSection = menuDrawer.querySelector('.menu-categories');
        if (categoriesSection) {
          categoriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      lastScrollTop = st;
    });
  }

// Wire static All Categories toggles (for pages with a static menu)
document.addEventListener('DOMContentLoaded', function() {
  // Generic function to wire a toggle and its container
  function wireToggle(toggleSelector, containerSelector) {
    const toggle = document.querySelector(toggleSelector);
    const container = document.querySelector(containerSelector);
    if (!toggle || !container) return;
    toggle.addEventListener('click', function(e){
      e.preventDefault();
      console.debug('[menu] allCategoriesToggle clicked (static)', toggleSelector, containerSelector);
      const isOpen = container.classList.toggle('open');
      const arrow = toggle.querySelector('.toggle-arrow');
      if (arrow) arrow.classList.toggle('toggle-rotated', isOpen);
      // Also toggle the page-level categories section if present
      const pageSection = document.getElementById('pageCategoriesSection');
      if (pageSection) {
        pageSection.classList.toggle('open', isOpen);
        pageSection.setAttribute('aria-hidden', !isOpen);
      }
    });

    // Wire category links inside container
    container.querySelectorAll('.menu-link').forEach(link => {
      link.addEventListener('click', async function(e){
        e.preventDefault();
        const category = this.getAttribute('data-category');
        if (!category) return;
        try {
          if (typeof supabase !== 'undefined' && supabase.rpc) {
            const { data, error } = await supabase.rpc('fetch_products_by_category', { cat: category });
            if (error) {
              console.warn('Error fetching products for', category, error);
            } else if (data && typeof renderProducts === 'function') {
              renderProducts(data);
            }
          }
        } catch (err) { console.warn('Category fetch failed', err); }

        // Close menu if present
        const menuDrawer = document.getElementById('menuDrawer');
        if (menuDrawer) { menuDrawer.classList.remove('open'); document.body.classList.remove('menu-drawer-open'); }

        const productsSection = document.getElementById('productsGrid');
        if (productsSection) {
          const header = document.querySelector('.lamar-header');
          const headerHeight = header ? header.offsetHeight : 0;
          const sectionTop = productsSection.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
          window.scrollTo({ top: sectionTop, behavior: 'smooth' });
          productsSection.classList.add('highlight-products-section');
          setTimeout(() => productsSection.classList.remove('highlight-products-section'), 800);
        }
      });
    });
  }

  // wire the index and product static toggles if present
  wireToggle('#allCategoriesToggle', '#menuCategoriesContainer');
  wireToggle('#allCategoriesToggleProduct', '#menuCategoriesContainerProduct');
});
// Wire page-level category links to behave like menu links (fetch/render/scroll)
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.page-category-link').forEach(link => {
    link.addEventListener('click', async function(e){
      e.preventDefault();
      const category = this.getAttribute('data-category');
      if (!category) return;
      try {
        if (typeof supabase !== 'undefined' && supabase.rpc) {
          const { data, error } = await supabase.rpc('fetch_products_by_category', { cat: category });
          if (error) console.warn('Error fetching products for', category, error);
          else if (data && typeof renderProducts === 'function') renderProducts(data);
        }
      } catch(err){ console.warn('Category fetch failed', err); }
      // Scroll to products grid
      const productsSection = document.getElementById('productsGrid');
      if (productsSection) {
        const header = document.querySelector('.lamar-header');
        const headerHeight = header ? header.offsetHeight : 0;
        const sectionTop = productsSection.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
        window.scrollTo({ top: sectionTop, behavior: 'smooth' });
        productsSection.classList.add('highlight-products-section');
        setTimeout(()=>productsSection.classList.remove('highlight-products-section'),800);
      }
    });
  });
});
  if (closeMenuDrawer && menuDrawer) {
    closeMenuDrawer.addEventListener('click', function() {
      menuDrawer.classList.remove('open');
      document.body.classList.remove('menu-drawer-open');
    });
  }
});
// Force two products per row in the grid
function enforceTwoPerRow() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  // Remove all whitespace between product cards to avoid inline-block issues
  grid.innerHTML = grid.innerHTML.replace(/>\s+</g, '><');
}
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(enforceTwoPerRow, 1000); // Wait for products to render
});
// Live Advert Product Rotator (Supabase version)
document.addEventListener('DOMContentLoaded', async function() {
  var nameElem = document.getElementById('liveAdvertProductName');
  var priceElem = document.getElementById('liveAdvertProductPrice');
  var imgElem = document.getElementById('liveAdvertProductImg');

  async function fetchProductsForAdvert() {
    // Adjust the select fields as per your Supabase 'products' table
  const { data, error } = await window.supabaseClient.from('products').select('name, price, image_url');
    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data;
  }

  let products = await fetchProductsForAdvert();
  if (!products || products.length === 0) {
    // fallback if no products
    products = [
      { name: 'No products available', price: '', image_url: '' }
    ];
  }
  let idx = 0;
  function showProduct(i) {
    var p = products[i];
    if (nameElem && priceElem && imgElem) {
      nameElem.textContent = p.name || '';
      priceElem.textContent = p.price ? `₦${p.price}` : '';
      if (p.image_url) {
        imgElem.src = p.image_url;
        imgElem.style.display = 'inline-block';
        imgElem.alt = p.name;
      } else {
        imgElem.style.display = 'none';
      }
    }
  setInterval(function() {
    idx = (idx + 1) % products.length;
    showProduct(idx);
  }, 3500);
}
});
// Fetch and render orders for the current user
async function fetchOrdersForUser(email) {
  // Adjust query if you want to filter by sender or other columns
  const { data, error } = await window.supabaseClient.from('orders').select('*').eq('email', email);
  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
  return data;
}

function renderOrders(orders) {
  const ordersGrid = document.getElementById('ordersGrid');
  if (!ordersGrid) return;
  // Remove the Order Senders section entirely
  ordersGrid.innerHTML = '';
  ordersGrid.style.display = 'none';
}
// The automatic test-order submission that used to run here has been removed.
// It attempted to insert rows without required fields (for example
// product_id) causing Postgres NOT NULL errors. If you need an automatic
// test insert, re-add a guarded implementation that supplies valid required
// fields, or invoke the insert from user-driven actions only.
  function showOrderModal(order) {
    let modal = document.getElementById('orderDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'orderDetailModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class='modal-content'>
          <span class='close'>&times;</span>
          <h2>Order Details</h2>
          <div><strong>Sender:</strong> ${order.sender_name || 'N/A'}</div>
          <div><strong>Product:</strong> ${order.product_id}</div>
          <div><strong>Quantity:</strong> ${order.quantity}</div>
          <div><strong>Status:</strong> ${order.status}</div>
          <div><strong>Pick Option:</strong> ${order.pick_option}</div>
          <div><strong>Address:</strong> ${order.address}</div>
        </div>
      `;
      document.body.appendChild(modal);
      (function(){
        var closeEl = modal.querySelector('.close');
        if (!closeEl) return;
        closeEl.addEventListener('click', function(){ modal.style.display = 'none'; });
      })();
    } else {
      modal.querySelector('h2').textContent = 'Order Details';
      modal.querySelectorAll('div')[1].innerHTML = `<strong>Sender:</strong> ${order.sender_name || 'N/A'}`;
      modal.querySelectorAll('div')[2].innerHTML = `<strong>Product:</strong> ${order.product_id}`;
      modal.querySelectorAll('div')[3].innerHTML = `<strong>Quantity:</strong> ${order.quantity}`;
      modal.querySelectorAll('div')[4].innerHTML = `<strong>Status:</strong> ${order.status}`;
      modal.querySelectorAll('div')[5].innerHTML = `<strong>Pick Option:</strong> ${order.pick_option}`;
      modal.querySelectorAll('div')[6].innerHTML = `<strong>Address:</strong> ${order.address}`;
    }
    modal.style.display = 'block';
    // Allow background scroll (do not add modal-open to body)
    // Close modal when clicking outside the modal content
    modal.addEventListener('mousedown', function(event) {
      if (event.target === modal) {
        modal.style.display = 'none';
        // Hide ordersGrid, show main screen
        const ordersGrid = document.getElementById('ordersGrid');
        if (ordersGrid) ordersGrid.style.display = 'none';
      }
    });
    // Close modal on X click
    (function(){
      var closeEl = modal.querySelector('.close');
      if (!closeEl) return;
      closeEl.addEventListener('click', function(){
        modal.style.display = 'none';
        // Hide ordersGrid, show main screen
        const ordersGrid = document.getElementById('ordersGrid');
        if (ordersGrid) ordersGrid.style.display = 'none';
      });
    })();
  }
// Make Orders menu item clickable to show user's orders
document.addEventListener('DOMContentLoaded', function() {
  const ordersMenuLink = document.querySelector('.menu-link[href="#orders"]');
  if (ordersMenuLink) {
    ordersMenuLink.addEventListener('click', function(e) {
      e.preventDefault();
      // Do nothing: orders grid is now disabled
      const ordersGrid = document.getElementById('ordersGrid');
      if (ordersGrid) {
        ordersGrid.innerHTML = '';
        ordersGrid.style.display = 'none';
      }
    });
  }
});
// Slide-out menu drawer logic
document.addEventListener('DOMContentLoaded', function() {
  const menuBtn = document.getElementById('menuBtn');
  const menuDrawer = document.getElementById('menuDrawer');
  const closeMenuDrawer = document.getElementById('closeMenuDrawer');
  // Remove Account menu if registered and show user info
  const menuDrawerContent = document.querySelector('.menu-drawer-content');
  function removeAccountLinks() {
    // Do not hide or remove the Switch Account button
    // Only remove other account links if needed (none in this case)
  }
  function showUserInfo(email) {
    if (!menuDrawerContent) return;
    let userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
      <div class="profile-row">
        <img src="assets/images/default-profile.png" alt="Profile" class="profile-thumb">
        <div>
          <div class="profile-name">Registered User</div>
          <div class="profile-email">${email}</div>
        </div>
      </div>
    `;
    // Remove any previous user info
    let oldUserInfo = menuDrawerContent.querySelector('.user-info');
    if (oldUserInfo) oldUserInfo.remove();
    // Insert user info after the close button
    let closeBtn = menuDrawerContent.querySelector('.close');
    if (closeBtn && closeBtn.nextSibling) {
      menuDrawerContent.insertBefore(userInfo, closeBtn.nextSibling);
    } else {
      menuDrawerContent.insertBefore(userInfo, menuDrawerContent.firstChild);
    }
  }

  if (localStorage.getItem('registeredEmail')) {
    showUserInfo(localStorage.getItem('registeredEmail'));
    // Change Google button to 'Switch Account' and set Gmail link
    var googleBtn = document.getElementById('accountMenuLink');
    // Previously this code auto-submitted a test order on page load. Disabled to
    // prevent accidental POSTs to Supabase (was causing 400 errors due to a
    // 'name' column being requested). If you need this behavior, re-enable and
    // ensure payload fields match your DB schema exactly.
    window.addEventListener('click', function(e) {
      if (e.target === menuDrawer) {
        menuDrawer.classList.remove('open');
        document.body.classList.remove('modal-open');
      }
    });
    // Category menu links: close menu and show category products
    document.querySelectorAll('.menu-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
          menuDrawer.classList.remove('open');
          const category = href.substring(1).toLowerCase();
          if (category) {
            if (category === 'chips' || category === 'ankara-style' || category === 'ankara') {
              filterProductsByCategory(category);
            }
            const productsSection = document.getElementById('productsGrid');
            if (productsSection) productsSection.scrollIntoView({behavior: 'smooth'});
          }
        }
      });
    });
    // Filtering function for chips and ankara style
    window.filterProductsByCategory = function(category) {
      // Fetch all products from Supabase and filter by category
  window.supabaseClient.from('products').select('*').then(({ data, error }) => {
        if (error || !data) return;
        const filtered = data.filter(p => {
          const cat = (p.category || '').toLowerCase();
          return cat.includes(category.replace('-', ' '));
        });
        renderProducts(filtered);
      });
    };
  }
});
  // Fetch and render products from Supabase with retry/backoff for transient network errors
  async function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

  async function fetchProducts(attempts = 3) {
    const client = window.supabaseClient;
    if (!client || typeof client.from !== 'function') {
      console.warn('fetchProducts: Supabase client not configured');
      return [];
    }

    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await client.from('products').select('*');
        if (!res) throw new Error('No response from Supabase');
        if (res.error) {
          // PostgREST returned an error object
          lastErr = res.error;
          // If it's a transient network-like error, retry
          console.warn(`[fetchProducts] attempt ${i+1} returned error:`, res.error);
          // fall through to retry
        } else {
          // success
          return Array.isArray(res.data) ? res.data : [];
        }
      } catch (err) {
        // Network / fetch failure (TypeError: Failed to fetch, QUIC errors, etc.)
        lastErr = err;
        console.warn(`[fetchProducts] attempt ${i+1} failed:`, err && err.message ? err.message : err);
      }

      // backoff before next attempt (exponential)
      const backoff = 500 * Math.pow(2, i);
      await sleep(backoff);
    }

    // All attempts failed — log consolidated error and return empty array so UI can handle it
    console.error('fetchProducts: all attempts failed. Last error:', lastErr);
    // Optionally surface a user-visible message in the products grid if present
    try {
      const grid = document.getElementById('productsGrid');
      if (grid) {
        grid.innerHTML = '<div class="center-padding">Network error loading products. Try reloading the page.</div>';
      }
    } catch (e) { /* non-fatal */ }
    return [];
  }

  function renderProducts(products, categoryMap) {
    const grid = document.getElementById('productsGrid');
    if (!grid) {
  // console.log('[DEBUG] productsGrid not found');
      return;
    }
    if (!products || products.length === 0) {
  // console.log('[DEBUG] No products to render');
  grid.innerHTML = '<div class="center-padding">No products available</div>';
      return;
    }
    // Infinite scroll/load more logic
    let shownCount = 0;
    if (!grid) {
  // console.log('[DEBUG] productsGrid not found');
      return;
    }
    if (!products || products.length === 0) {
  // console.log('[DEBUG] No products to render');
  grid.innerHTML = '<div class="center-padding">No products available</div>';
      return;
    }
    // Render all products at once, allow grid to scroll
    // detect whether we're on the categories page and should suppress share buttons
    const isCategoriesPage = !!document.getElementById('categoriesList');

      const LOCAL_PLACEHOLDER = 'assets/images/placeholder.svg';
      grid.innerHTML = products.map(product => {
        const categoryName = categoryMap && product.category_id ? categoryMap[product.category_id] : (product.category || 'N/A');
        const imageUrl = product.image_url || LOCAL_PLACEHOLDER;
        return `
          <div class="product-card" data-product-id="${product.id}" data-href="${(isCategoriesPage && imageUrl) ? ('new-product.html?image_url=' + encodeURIComponent(String(imageUrl)) + '&name=' + encodeURIComponent(String(product.name || ''))) : ((String(product.name||'').toLowerCase().indexOf('phone4')!==-1)?'new-product.html':'')}">
            <div class="product-thumb">
              <img src="${imageUrl}" alt="${product.name || 'Product'}" 
                   loading="lazy" 
                   onerror="this.onerror=null;this.src='assets/images/placeholder.svg';">
            </div>
            <div class="product-overlay">
              <button class="icon-btn heart" data-action="wishlist" title="Add to wishlist">❤</button>
              <button class="icon-btn compare" data-action="compare" title="Compare">⇄</button>
            </div>
            <img src="${product.image_url || 'assets/images/placeholder.svg'}" alt="${product.name}" class="product-img">
            <div class="product-name">${product.name}</div>
            <div class="category">Category: ${categoryName}</div>
            <div class="description">${product.description || 'No description available.'}</div>
            <div class="stock">Stock: ${product.stock !== undefined ? product.stock : 'N/A'}</div>
            <div class="price">₦${Number(product.price).toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="product-addbar" data-action="addbar">
              <span class="add-text">Add to cart</span>
            </div>
            <div class="product-card-actions">
              ${isCategoriesPage ? '' : `<button class="share-offer" title="Share and get 20% off">Share &amp; 20% off</button>`}
            </div>
            
          </div>
        `;
      }).join('');
    // Add event listeners for Buy Now buttons (delegated globally below as well)
    // Add event listeners for View and Add to Cart buttons
    // View button toggles extra details on the card
    // View button removed; all details are always visible
    grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.getAttribute('data-product-id');
        const product = products.find(p => String(p.id) === String(id));
        // Add to cart without alert
        if (product) addToCart(product);
      });
    });

      // View button removed — details are always visible on the card

    // Modal logic removed
}

// Global event delegation for any .buy-btn (handles dynamically added buttons)
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.buy-btn');
  if (btn) {
    // Try to find the product info from the current products rendered
    // This assumes products are globally available or can be found from DOM
    let product = null;
    if (typeof window.products !== 'undefined' && Array.isArray(window.products)) {
      const id = btn.getAttribute('data-id');
      product = window.products.find(p => String(p.id) === String(id));
    }
    // Fallback: try to get info from data attributes if available
    if (!product) {
      product = {
        id: btn.getAttribute('data-id'),
        name: btn.getAttribute('data-name') || '',
        price: btn.getAttribute('data-price') || '',
      };
    }
    openBuyModal(product);
    e.preventDefault();
  }
});

// Delegation for product overlay actions (wishlist, compare, add-to-cart)
document.addEventListener('click', function(e) {
  const overlayBtn = e.target.closest('.icon-btn');
  if (overlayBtn) {
    const action = overlayBtn.getAttribute('data-action');
    const card = overlayBtn.closest('.product-card');
    const id = card ? card.getAttribute('data-product-id') : null;
    // Placeholder behaviors
    if (action === 'wishlist') {
      // Visual feedback (toggle active)
      overlayBtn.classList.toggle('active');
      return;
    }
    if (action === 'compare') {
      overlayBtn.classList.toggle('active');
      return;
    }
  }
  const addbar = e.target.closest('.product-addbar');
  if (addbar) {
    const card = addbar.closest('.product-card');
    const id = card ? card.getAttribute('data-product-id') : null;
    if (!id) return;
    // Try to find product from the rendered products if available
    let product = null;
    if (typeof window.products !== 'undefined' && Array.isArray(window.products)) {
      product = window.products.find(p => String(p.id) === String(id));
    }
    if (!product) {
      // Build minimal product object from DOM
      product = {
        id,
        name: card.querySelector('.product-name')?.textContent || '',
        price: parseFloat(card.querySelector('.price')?.textContent.replace(/[^0-9.-]+/g, '')) || 0,
        image_url: card.querySelector('.product-img')?.getAttribute('src')
      };
    }
    if (product) {
      addToCart(product);
    }
    return;
  }
  // Share button: navigate to the product's dedicated page or new-product.html
  
  
});

// Click on product card (excluding overlay/addbar) navigates to product detail page
// Accept several card container classes used across the site (product-card, np-card, ap-card, card)
document.addEventListener('click', function(e) {
  const card = e.target.closest('.product-card, .np-card, .ap-card, .card, .product-card-clickable');
  if (!card) return;
  // Save selected product image to sessionStorage so dedicated page can display it
  try {
    let dataImg = card.getAttribute('data-image') || card.getAttribute('data-img');
    if (!dataImg) {
      const imgEl = card.querySelector('img');
      if (imgEl) {
        dataImg = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-image') || imgEl.getAttribute('data-lazy') || imgEl.getAttribute('srcset');
        // if srcset, pick the first URL
        if (dataImg && dataImg.indexOf(',') !== -1) dataImg = dataImg.split(',')[0].trim().split(' ')[0];
      }
    }
    if (dataImg) {
      try {
        // resolve relative URLs against current location
        const resolved = new URL(dataImg, window.location.href).toString();
        sessionStorage.setItem('selectedProductImage', resolved);
      } catch (e) {
        // fallback to raw value
        sessionStorage.setItem('selectedProductImage', dataImg);
      }
    }
  } catch (err) { /* ignore */ }
  // ignore clicks on overlay controls, addbar, or add-cart so these do not navigate
  if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar') || e.target.closest('.add-cart')) return;
  // Special-case: New Products card titled "phone4" should always go to new-product.html
  try {
    const npTitle = card.querySelector && (card.querySelector('.np-title') || card.querySelector('.np-meta .np-title'));
    const t = npTitle ? (npTitle.textContent || '').trim().toLowerCase() : '';
    if (t && t.indexOf('phone4') !== -1) {
      window.location.href = 'new-product.html';
      return;
    }
  } catch (err) { /* ignore */ }
  // If this card contains a share button, treat clicks on the card as navigation
  // to the special new-product page (preserves existing behavior for share btns).
  try {
    if (card.querySelector && card.querySelector('.share-product')) {
      window.location.href = 'new-product.html';
      return;
    }
  } catch (err) { /* ignore */ }
  // Prefer an explicit link/href on the card if present
  const explicitHref = card.getAttribute('data-href') || card.getAttribute('data-url') || card.getAttribute('data-link') || (card.querySelector && (card.querySelector('a.np-link') || card.querySelector('a[href]')) && (card.querySelector('a.np-link') || card.querySelector('a[href]')).getAttribute('href'));
  if (explicitHref) {
    // allow anchor hrefs to be followed
    window.location.href = explicitHref;
    return;
  }

  // fallback to slug or id
  const slug = card.getAttribute('data-slug') || card.getAttribute('data-product-slug') || card.getAttribute('data-slug-id');
  if (slug) {
    window.location.href = 'product.html?slug=' + encodeURIComponent(slug);
    return;
  }
  const id = card.getAttribute('data-product-id') || card.getAttribute('data-id');
  if (id) {
    window.location.href = 'product.html?id=' + encodeURIComponent(id);
    return;
  }
  // Final fallback: try to derive product name from visible title and navigate with a name query
  try {
    const titleEl = card.querySelector('.product-title, .product-name, .np-title, .np-meta .np-title');
    const title = titleEl ? titleEl.textContent.trim() : '';
    if (title) {
      console.debug('[product-click] no id/slug/href — falling back to name query for', title);
      window.location.href = 'product.html?name=' + encodeURIComponent(title);
      return;
    }
  } catch (e) { /* ignore */ }
});

document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('buyModal');
  const menuBtn = document.getElementById('menuBtn');
  // Always hide the modal on page load
  if (modal) {
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    (function(){
      var closeEl = modal.querySelector('.close');
      if (closeEl) closeEl.addEventListener('click', function(){
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        if (menuBtn) menuBtn.disabled = false;
      });
    })();
    window.addEventListener('click', function(event){
      if (event.target === modal) {
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        if (menuBtn) menuBtn.disabled = false;
      }
    });
    // Handle order form submission
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
      orderForm.onsubmit = async function(e) {
        e.preventDefault();
        const quantity = Number(document.getElementById('orderQuantity').value);
        const product_price = Number(modal.dataset.productPrice);
        const order_total = product_price * quantity;
  const product_id = modal.dataset.productId;
  const product_name = modal.dataset.productName;
        const user_name = document.getElementById('orderUserName').value;
        const email = document.getElementById('orderEmail').value;
  // const phone = document.getElementById('orderPhone').value; // Removed duplicate declaration
  // const address = document.getElementById('orderAddress').value; // Removed duplicate declaration
        const status = 'pending'; // or get from a field if needed
        const pick_option = document.getElementById('orderPickOption').value;
        const orderStatus = document.getElementById('orderStatus');
        // Validate product_id is a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!product_id || !uuidRegex.test(product_id)) {
          orderStatus.textContent = 'Error: Product ID is missing or invalid.';
          orderStatus.style.color = 'red';
          return;
        }
        // Send order to Supabase
  // Use returning: 'minimal' to avoid columns query param and ensure we use user_name/pick_option
  let insertResult;
  try {
    insertResult = await window.supabaseClient.from('orders').insert([
      {
        quantity,
        order_total,
        product_id,
        product_name,
        user_name,
        email,
        phone,
        address,
        status,
        pick_option
      }
    ], { returning: 'minimal' });
  } catch (e) {
    insertResult = { error: e };
  }
  const { error: insertError } = insertResult || {};
  if (insertError) {
    orderStatus.textContent = 'Order failed: ' + (insertError.message || JSON.stringify(insertError));
    orderStatus.style.color = 'red';
  } else {
    // proceed
  }
        if (error) {
          orderStatus.textContent = 'Order failed: ' + error.message;
          orderStatus.style.color = 'red';
        } else {
          // Reduce product stock in Supabase
          const { error: stockError } = await supabase.rpc('decrement_product_stock', {
            product_id,
            quantity
          });
          if (stockError) {
            orderStatus.textContent = 'Order placed, but failed to update stock: ' + stockError.message;
            orderStatus.style.color = 'orange';
          } else {
            orderStatus.textContent = 'Order placed successfully!';
            orderStatus.style.color = 'green';
            // Optionally refresh product grid to show updated stock
            if (typeof fetchProducts === 'function') {
              const products = await fetchProducts();
              renderProducts(products);
            }
          }
          orderForm.reset();
        }
      };
    }
  }
  });
  // Additional code follows...
// Lamar Mobile JS (structure similar to desktop)
// Lamar Mobile JS (structure similar to desktop)
// Ensure Supabase CORS settings include: https://glittery-torrone-d1184e.netlify.app
// Add your product/category logic here as needed
// Supabase credentials must be provided securely via environment variables or backend API.
// Remove public key from frontend for security. See README for setup instructions.
if (!window.supabaseClient) {
  if (window.SUPABASE_URL && window.SUPABASE_KEY) {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  } else {
    console.warn('Supabase credentials are not set. Please provide them securely.');
  }
}
// If deploying to Netlify, make sure CORS settings in Supabase dashboard include your Netlify URL
    // Add this function to update the account section
    function updateAccountSection() {
  const accountMenu = document.getElementById('accountMenuLink');
    const userName = localStorage.getItem('name');
    const userEmail = localStorage.getItem('email');
    const userPic = localStorage.getItem('profilePic');

    if (userName && userEmail) {
          // Remove the Account menu item completely
          if (accountMenu) accountMenu.parentNode.removeChild(accountMenu);

      // Show user info
      const userInfo = document.createElement('div');
      userInfo.className = 'user-info';
      userInfo.innerHTML =
        `<div class="profile-row">
          <img src="${userPic || 'assets/images/default-profile.png'}" alt="Profile" class="profile-thumb">
          <div>
            <div class="profile-name">${userName}</div>
            <div class="profile-email">${userEmail}</div>
          </div>
        </div>`;
      // Insert userInfo before the menu or in the sidebar
      const sidebar = document.querySelector('.sidebar'); // Adjust selector as needed
      if (sidebar) sidebar.insertBefore(userInfo, sidebar.firstChild);
    }
    }

    // Call this on page load
  window.addEventListener('DOMContentLoaded', updateAccountSection);

// Global handler: when user clicks any "My Account" nav label, show account details.
document.addEventListener('click', function (e) {
  const el = e.target.closest && e.target.closest('.nav-label, .account-links a, .account-area, .account-circle');
  if (!el) return;
  const text = (el.textContent || '').trim().toLowerCase();
  if (text.indexOf('my account') === -1 && text.indexOf('account') === -1) return;
  e.preventDefault();
  // If page already has a full account modal showAccountModal, call it
  if (typeof window.showAccountModal === 'function') {
    try { window.showAccountModal(); return; } catch (err) { /* fallthrough */ }
  }

  // Otherwise build a small modal dynamically that shows user info (or redirects to login/register)
  const userName = localStorage.getItem('userName') || localStorage.getItem('name');
  const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('email');

  if (!userEmail) {
    // Not logged in — go to login/register page
    window.location.href = 'register.html';
    return;
  }

  // Remove existing lightweight modal if present
  const existing = document.getElementById('lightAccountModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'lightAccountModal';
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.right = '0';
  modal.style.bottom = '0';
  modal.style.background = 'rgba(0,0,0,0.4)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  const card = document.createElement('div');
  card.style.background = '#fff';
  card.style.padding = '18px';
  card.style.borderRadius = '8px';
  card.style.width = '320px';
  card.style.boxShadow = '0 8px 28px rgba(0,0,0,0.2)';

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <strong>My Account</strong>
      <button id="lightAccountClose" style="background:none;border:none;font-size:18px;cursor:pointer">&times;</button>
    </div>
    <div style="margin-bottom:8px"><strong>Name:</strong> <div style="color:#333">${userName || 'User'}</div></div>
    <div style="margin-bottom:14px"><strong>Email:</strong> <div style="color:#333">${userEmail}</div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="lightAccountSignOut" style="padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer">Sign out</button>
      <button id="lightAccountManage" style="padding:8px 12px;border-radius:6px;border:none;background:#ff5722;color:#fff;cursor:pointer">Manage</button>
    </div>
  `;

  modal.appendChild(card);
  document.body.appendChild(modal);

  document.getElementById('lightAccountClose').addEventListener('click', () => modal.remove());
  document.getElementById('lightAccountSignOut').addEventListener('click', () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userJoinDate');
    modal.remove();
    // Update any UI
    if (typeof updateAccountSection === 'function') updateAccountSection();
  });
  document.getElementById('lightAccountManage').addEventListener('click', () => {
    modal.remove();
    window.location.href = 'account.html' ; // change if you have account page
  });
});

document.addEventListener('DOMContentLoaded', async function() {
  // Example: handle nav active state
  document.querySelectorAll('.mobile-nav .nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      document.querySelectorAll('.mobile-nav .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      e.preventDefault();
    });
  });

  // Return hardcoded categories since we're not using a categories table
  async function fetchCategories() {
    return [
      { id: 'phones', name: 'Phones', image: 'assets/images/phone-category.png' },
      { id: 'laptops', name: 'Laptops', image: 'assets/images/laptop-category.png' },
      { id: 'tvs', name: 'TVs', image: 'assets/images/tv.png' },
      { id: 'accessories', name: 'Accessories', image: 'assets/images/accessories-category.png' }
    ];
  }

  function renderCategories(categories) {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    if (!categories || categories.length === 0) {
  grid.innerHTML = '<div class="center-padding">No categories available</div>';
      return;
    }
    grid.innerHTML = categories.map(cat => {
      return `
        <div class="category-card" data-category-id="${cat.id}" data-category-name="${cat.name}">
          <div>${cat.name}</div>
        </div>
      `;
    }).join('');
  }

  // On DOMContentLoaded, fetch and render categories and products
  const categories = await fetchCategories();
  renderCategories(categories);
  const products = await fetchProducts();

  // Map category id to name for easy lookup
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.id] = cat.name;
  });

  // Render all products by default, but avoid calling the global renderer on the accessories page
  // (accessories page uses its own renderer and grid). If an accessoriesGrid exists, skip this.
  try {
    if (!document.getElementById('accessoriesGrid')) {
      renderProducts(products, categoryMap);
    } else {
      // clear any accidental content and rely on accessories.js to render
      const g = document.getElementById('accessoriesGrid'); if (g) g.innerHTML = '';
    }
  } catch (e) {
    // If anything goes wrong, fall back to original behavior
    try { renderProducts(products, categoryMap); } catch (err) { console.warn('renderProducts fallback failed', err); }
  }

  // Map menu link hrefs to category names
  // Use lowercase category names for matching
  const hrefToCategory = {
    '#phones': 'phones',
    '#tablets': 'tablet',
  '#laptops': 'laptops',
  '#accessories': 'accessories',
    '#appliances': 'appliances',
    '#electronics': 'electronics',
    '#supermarket': 'supermarket',
    '#health': 'health',
    '#home': 'home',
    '#power': 'power',
    '#computing': 'computing',
    '#womens-fashion': "women's fashion",
    '#mens-fashion': "men's fashion",
    '#baby': 'baby',
    '#gaming': 'gaming'
  };
  // Add click listeners to menu category links for filtering
  document.querySelectorAll('.menu-categories .menu-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      const categoryName = hrefToCategory[href];
      if (!categoryName) {
        renderProducts(products, categoryMap);
        return;
      }
  // Find category id by name (lowercase)
  const categoryId = Object.keys(categoryMap).find(id => categoryMap[id].toLowerCase() === categoryName);
  // Filter products by category id or lowercase name
  const filtered = products.filter(p => (categoryId && String(p.category_id) === String(categoryId)) || (p.category && p.category.toLowerCase() === categoryName));
  renderProducts(filtered, categoryMap);
    });
  });
});
// Show the orders modal and prevent background scroll
function showOrdersModal() {
  const modal = document.getElementById('ordersModal');
  if (modal) {
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    // Hide modal if user clicks outside modal content
    modal.addEventListener('mousedown', function(event) {
      if (event.target === modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
      }
    });
  }
}
// When showing buy modal, also prevent scroll
// When closing buy modal, restore scroll
function closeBuyModal() {
  const modal = document.getElementById('buyModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
      // Restore visibility of product details
      if (nameElem) nameElem.style.display = '';
      if (imgElem) imgElem.style.display = '';
      details.forEach(d => d.style.display = '');
  }
}
// Ensure Buy Now modal can be closed and always shows/hides correctly
// Add this after openBuyModal definition

document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('buyModal');
  if (!modal) return;
  const closeBtn = modal.querySelector('.close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(){
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    });
  }
  // Optional: close modal if user clicks outside modal content
  modal.addEventListener('mousedown', function(event) {
    if (event.target === modal) {
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  });
});

// Product Image Gallery Modal Logic
function setupProductImageGallery(product) {
  // Example: product.images = [url1, url2, url3]
  var images = product.images && product.images.length ? product.images : [product.image_url || 'assets/images/placeholder.svg'];
  var modal = document.getElementById('imageGalleryModal');
  var mainImg = document.getElementById('galleryMainImg');
  var thumbnails = document.getElementById('galleryThumbnails');
  var prevBtn = document.getElementById('galleryPrevBtn');
  var nextBtn = document.getElementById('galleryNextBtn');
  var closeBtn = document.getElementById('closeGalleryModal');
  var currentIdx = 0;

  function showImage(idx) {
    if (!images.length) return;
    currentIdx = idx;
    mainImg.src = images[idx];
    // Highlight selected thumbnail
    Array.from(thumbnails.children).forEach((thumb, i) => {
      thumb.classList.toggle('selected', i === idx);
    });
  }

  // Render thumbnails
  if (thumbnails) {
  thumbnails.innerHTML = images.map((img, idx) => `<img src="${img}" class="gallery-thumb" data-idx="${idx}" />`).join('');
    Array.from(thumbnails.children).forEach((thumb, idx) => {
      thumb.addEventListener('click', function(){ showImage(idx); });
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', function(){ showImage((currentIdx - 1 + images.length) % images.length); });
  if (nextBtn) nextBtn.addEventListener('click', function(){ showImage((currentIdx + 1) % images.length); });
  if (closeBtn) closeBtn.addEventListener('click', function(){ modal.style.display = 'none'; document.body.style.overflow = ''; });

  showImage(0);
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

// Attach click to main product image (on product.html)
document.addEventListener('DOMContentLoaded', function() {
  var mainImg = document.querySelector('.product-gallery-img');
  if (mainImg) {
    mainImg.style.cursor = 'pointer';
    mainImg.addEventListener('click', function(){
      // Get product images from global or fallback
      var product = window.productData || {};
      // If productData not set, fallback to image_url only
      if (!product.images) product.images = [mainImg.src];
      setupProductImageGallery(product);
    });
  };
});
