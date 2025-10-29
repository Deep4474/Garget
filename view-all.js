/* view-all.js
   Fetch products from product, product2, product3 and render a combined grid.
*/
(function(){
  'use strict';

  function ensureClient(){
    if (window.__LAMAR_SUPABASE) return window.__LAMAR_SUPABASE;
    // Prefer an existing global `supabase` instance if present
    if (window.supabase && typeof window.supabase.from === 'function') {
      window.__LAMAR_SUPABASE = window.supabase;
      return window.__LAMAR_SUPABASE;
    }
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY;
    if (!url || !key) {
      // cannot create a client here; caller should handle null
      return null;
    }
    const client = supabase.createClient(url, key);
    window.__LAMAR_SUPABASE = client;
    return client;
  }

  function el(sel){ return document.querySelector(sel); }

  function guessImage(rec){
    // common candidates
    const candidates = ['image_url','image','images','image_urls','photo','photos','thumbnail','thumb','img','imageUrl','imageUrl1'];
    for (const k of candidates){
      if (!rec) continue;
      if (rec[k]) return rec[k];
      // try nested structures like { url: '...' }
      if (rec[k] && typeof rec[k] === 'object' && rec[k].url) return rec[k].url;
    }
    return null;
  }

  function escapeHtml(s){
    if (s == null) return '';
    return String(s).replace(/[&<>"'`]/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]);
    });
  }

  function formatPrice(p){
    if (p == null) return '';
    const n = Number(p);
    if (Number.isNaN(n)) return String(p);
    return '₦' + n.toLocaleString();
  }

  function renderProducts(container, items){
    container.innerHTML = '';
    if (!items || items.length === 0){
      container.innerHTML = '<div class="ap-empty">No products found.</div>';
      return;
    }

    // two-column mobile-friendly grid
    const grid = document.createElement('div');
    grid.className = 'all-products-grid view-all-grid';

    for (const p of items){
      const imgUrl = guessImage(p) || 'assets/images/smartphone.png';
      const titleText = p.name || p.title || p.product_name || 'Untitled';
      const priceText = formatPrice(p.price || p.amount || p.sell_price || p.cost) || '';

      // If this row comes from product5, make the entire card link to new-product.html with image_url and name
      const productHref = p.__src === 'product5' ? ('new-product.html' + (imgUrl ? ('?image_url=' + encodeURIComponent(imgUrl) + '&name=' + encodeURIComponent(titleText)) : '')) : (p.slug ? ('product.html?slug=' + encodeURIComponent(p.slug)) : (p.id ? ('product.html?id=' + encodeURIComponent(p.id)) : '#'));
      // For product5 use a clickable anchor that wraps the content and omit the per-card share button.
      const overlayBottom = p.__src === 'product5' ? '' : `<button class="add-cart">Add to cart</button>`;

      const cardHtml = `
        <a class="card ap-card" href="${productHref}" data-id="${escapeHtml(p.id || '')}" data-name="${escapeHtml(titleText)}" data-price="${escapeHtml(String(p.price||''))}" data-image="${escapeHtml(imgUrl)}">
          <div class="card-inner">
            <div class="thumb" style="background-image:url('${escapeHtml(imgUrl)}')"></div>
            <div class="card-body">
              <div class="card-title">${escapeHtml(titleText)}</div>
              <div class="card-price">${escapeHtml(priceText)}</div>
            </div>

            <!-- hover overlay -->
            <div class="card-overlay">
              <div class="overlay-top">
                <button class="ico-btn wish" title="Add to wishlist">♡</button>
                <button class="ico-btn compare" title="Compare">⇄</button>
              </div>
              <div class="overlay-bottom">
                ${overlayBottom}
              </div>
            </div>
          </div>
        </a>
      `;
      grid.insertAdjacentHTML('beforeend', cardHtml);
    }

    container.appendChild(grid);
  }

  const __missingTableCache = new Set();
  async function fetchTable(client, tableName){
    // Attempt to select from tableName. If the table doesn't exist (PGRST205)
    // try a suggested name from the error hint, then fall back to common names.
    try {
      const res = await client.from(tableName).select('*').limit(200);
      if (!res.error) return Array.isArray(res.data) ? res.data : [];

      // If PostgREST returns PGRST205 (table not found) try to parse suggestion
      try {
        const err = res.error || {};
        if (err.code === 'PGRST205' && err.hint && typeof err.hint === 'string'){
          const m = err.hint.match(/'([^']+)'/);
          if (m && m[1]){
            const parts = m[1].split('.');
            const suggested = parts[parts.length-1];
            try {
              const tryRes = await client.from(suggested).select('*').limit(200);
              if (!tryRes.error) return Array.isArray(tryRes.data) ? tryRes.data : [];
            } catch(_) { /* ignore */ }
          }
        }
      } catch(_) { /* ignore suggestion parse issues */ }

      // Common fallback table names to try (avoid endless loops)
      const fallbacks = ['products','product','product2','product3'];
      for (const t of fallbacks){
        if (__missingTableCache.has(t)) continue;
        if (t === tableName) continue;
        try {
          const r = await client.from(t).select('*').limit(200);
          if (!r.error) return Array.isArray(r.data) ? r.data : [];
          // record missing table to skip future attempts
          if (r.error && r.error.code === 'PGRST205') __missingTableCache.add(t);
        } catch(_) { /* ignore and continue */ }
      }

      // If none worked, return empty instead of throwing — caller handles empty sets.
      return [];
    } catch (err){
      // don't noisy-log every missing table; return empty so callers continue
      return [];
    }
  }

  async function loadAll(){
    const root = document.getElementById('allProductsRoot');
    const loading = root.querySelector('.ap-loading') || document.querySelector('.ap-loading');
    const client = ensureClient();

    // if client is not available, show error
    if (!client){
      if (loading) loading.innerHTML = 'Supabase configuration missing.';
      return;
    }

    try {
      loading && (loading.textContent = 'Fetching products...');
  const tables = ['product5','products','product2','product3'];
      const promises = tables.map(t => fetchTable(client, t));
      const results = await Promise.all(promises);
      // flatten and tag with source table
      let all = [];
      for (let i = 0; i < results.length; i++){
        const rows = results[i] || [];
        const src = tables[i];
        for (const row of rows) {
          all.push(Object.assign({ __src: src }, row || {}));
        }
      }
      // Remove any products coming from product3 as requested
      all = all.filter(item => item && item.__src !== 'product3');
      // assign a parsed date for sorting
      all.forEach(item => {
        const d = item.created_at || item.createdAt || item.date || item.inserted_at;
        item.__createdAt = d ? new Date(d) : new Date(0);
      });
      all.sort((a,b) => b.__createdAt - a.__createdAt);

    // store items globally for client-side sorting
    window.__ALL_PRODUCTS = all;
    applySortAndRender();
    } catch (err){
      console.error(err);
      root.innerHTML = '<div class="ap-error">Failed to load products. Check console for details.</div>';
    }
  }

  function applySortAndRender(){
    const sortSelect = document.getElementById('sortSelect');
    const val = sortSelect ? sortSelect.value : 'newest';
    const items = Array.isArray(window.__ALL_PRODUCTS) ? window.__ALL_PRODUCTS.slice() : [];
    if (val === 'price-asc') items.sort((a,b)=> (Number(a.price||a.amount||0) - Number(b.price||b.amount||0)));
    else if (val === 'price-desc') items.sort((a,b)=> (Number(b.price||b.amount||0) - Number(a.price||a.amount||0)));
    else items.sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
    renderProducts(document.getElementById('allProductsContainer'), items);
  }

  // wait for supabase script to load (global `supabase` available)
  function whenSupabaseReady(){
    if (window.supabase && typeof window.supabase.createClient === 'function') return Promise.resolve();
    return new Promise((resolve) => {
      const max = 5000; // 5s
      const start = Date.now();
      (function check(){
        if (window.supabase && typeof window.supabase.createClient === 'function') return resolve();
        if (Date.now() - start > max) return resolve();
        setTimeout(check, 50);
      })();
    });
  }

  document.addEventListener('DOMContentLoaded', async function(){
    await whenSupabaseReady();
    try { loadAll(); } catch (e) { console.error(e); }

    // wire sort control
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect){ sortSelect.addEventListener('change', applySortAndRender); }

    // floating chevron scroll-to-top
    const che = document.getElementById('floatingChevron');
    if (che){ che.addEventListener('click', ()=> window.scrollTo({ top: 0, behavior: 'smooth' })); }

    // delegated handler for Share button (open new-product with image_url)
    document.body.addEventListener('click', function(e){
      var t = e.target;
      if (!t) return;
      var sbtn = t.closest && t.closest('.share-product');
      if (!sbtn) return;
      var img = (sbtn.getAttribute && sbtn.getAttribute('data-image')) || (sbtn.dataset && sbtn.dataset.image) || '';
      if (!img) {
        var card = sbtn.closest && sbtn.closest('.card');
        if (card) {
          var imgTag = card.querySelector && (card.querySelector('img') || card.querySelector('.thumb'));
          if (imgTag && imgTag.src) img = imgTag.src;
          if (!img) {
            var thumb = card.querySelector && (card.querySelector('.thumb'));
            if (thumb) {
              var style = window.getComputedStyle(thumb);
              var bg = style && style.backgroundImage;
              if (bg && bg !== 'none') {
                var m = bg.match(/url\(["']?(.+?)["']?\)/);
                if (m) img = m[1];
              }
            }
          }
        }
      }
      try { if (img && !/^https?:\/\//i.test(img)) img = new URL(img, window.location.href).href; } catch(e){}
      try { if (img) sessionStorage.setItem('selectedProductImageUrl', img); } catch(e){}
      var href = 'new-product.html' + (img ? ('?image_url=' + encodeURIComponent(img)) : '');
      window.open(href, '_blank');
    });
  });

})();
