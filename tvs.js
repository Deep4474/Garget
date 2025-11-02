(async function(){
  // Prevent duplicate initialization
  if (window.tvsInitialized) return;
  window.tvsInitialized = true;

  // TV-related keywords for searching
  const TV_KEYWORDS = ['tv', 'television', 'smart tv', 'led tv', 'oled'];

  // Query the new Supabase project's REST endpoint for TVs
  const TV_SUPABASE_URL = 'https://ahzfkfxqtdtkrwlxvimp.supabase.co';
  const TV_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoemZrZnhxdGR0a3J3bHh2aW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcyMDksImV4cCI6MjA3NzM5MzIwOX0.us--sBWAKTPJrd4gPKMPLBgtkJVhAcrUEQoD9YTnJww';
  const TV_REST_BASE = String(TV_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1';

  // Helper to fetch products from a table that match TV keywords
  async function restFetchTableForKeyword(table, keyword) {
    try {
      if (!TV_REST_BASE || !TV_SUPABASE_ANON_KEY) return [];
      const q = encodeURIComponent(`name.ilike.*${keyword}*,category.ilike.*${keyword}*`);
      const url = `${TV_REST_BASE}/${encodeURIComponent(table)}?select=*&or=(${q})&limit=500`;
      const res = await fetch(url, { headers: { 'apikey': TV_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + TV_SUPABASE_ANON_KEY } });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map(d => Object.assign({}, d, { __source: table, __table: table }));
    } catch (e) {
      return [];
    }
  }

  // Fetch TVs from the products table
  async function fetchTVProducts() {
    const tables = ['products'];  // Only use the 'products' table in the new project
    let results = [];

    // Try REST endpoints first
    for (const t of tables) {
      for (const kw of TV_KEYWORDS) {
        try {
          const r = await restFetchTableForKeyword(t, kw);
          if (Array.isArray(r) && r.length) results = results.concat(r);
        } catch(e){}
      }
    }

    // If REST queries found results, use those
    if (results.length) return results;

    // Otherwise try global supabase client if available
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      for (const t of tables) {
        for (const kw of TV_KEYWORDS) {
          try {
            const q = await window.supabaseClient.from(t).select('*').or(`name.ilike.*${kw}*,category.ilike.*${kw}*`).limit(500);
            if (q && !q.error && Array.isArray(q.data)) {
              results = results.concat(q.data.map(r => Object.assign({}, r, { __source: t, __table: t })));
            }
          } catch(e){}
        }
      }
    }

    return results;
  }

  // Render the TV grid
  function renderTVs(products) {
    const grid = document.getElementById('tvsGrid');
    if (!grid) return;

    if (!Array.isArray(products) || !products.length) {
      grid.innerHTML = '<div class="ap-empty">No TVs found</div>';
      return;
    }

    // Normalize and dedupe by id/slug
    const seen = new Set();
    const rows = [];
    products.forEach(p => {
      const id = String(p.id || p.slug || (p.name && p.name.trim().toLowerCase()) || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      rows.push(p);
    });

    grid.innerHTML = rows.map(p => {
      const img = p.image_url || p.image || 'assets/images/tv.png';
      const title = (p.name || p.title || p.product_name || 'Untitled').replace(/</g,'&lt;');
      const price = Number(p.price || p.amount || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
      const slug = p.slug || p.id || '';
      const pid = p.id || p.product_id || slug || '';
      const _srcLabel = p.source || p.__source || p.__table || '';
      const sourceBadge = (_srcLabel && _srcLabel !== 'product5') ? `<div class="source-badge">${_srcLabel}</div>` : '';
      const isProduct5 = (p.source === 'product5' || p.__source === 'product5' || p.__table === 'product5');
      const productHref = isProduct5 ? ('new-product.html' + (img ? ('?image_url=' + encodeURIComponent(img) + '&name=' + encodeURIComponent(p.name || '')) : '')) : ('product.html' + (slug ? ('?id=' + encodeURIComponent(slug)) : ''));

      return `
        <article class="product-card" data-product-id="${pid}" data-slug="${slug}" data-href="${productHref}">
          <div class="product-overlay">
            <button class="icon-btn heart" data-action="wishlist" title="Add to wishlist">❤</button>
            <button class="icon-btn compare" data-action="compare" title="Compare">⇄</button>
          </div>
          <div class="product-thumb-wrap">
            <img class="product-img product-thumb" src="${img}" alt="${title}" onerror="this.src='assets/images/tv.png'">
          </div>
          <h3 class="product-name product-title">${title}</h3>
          <div class="price product-price">${price}</div>
          ${sourceBadge}
          ${ isProduct5 ? `
            <div class="product-card-actions"></div>
          ` : `
            <div class="product-addbar" data-action="addbar"><span class="add-text">Add to cart</span></div>
          ` }
        </article>
      `;
    }).join('\n');

    // Wire up click handlers
    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', function(e){
        if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar')) return;
        const href = card.getAttribute('data-href');
        if (href) window.location.href = href;
      });

      // Optional: touch handler for mobile (first tap shows overlay)
      let lastTouch = 0;
      card.addEventListener('touchstart', function(e){
        if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar')) return;
        const now = Date.now();
        if (lastTouch && (now - lastTouch) < 800) {
          const href = card.getAttribute('data-href');
          if (href) window.location.href = href;
          return;
        }
        document.querySelectorAll('.product-card.touch-hover').forEach(c => c.classList.remove('touch-hover'));
        card.classList.add('touch-hover');
        lastTouch = now;
      }, { passive: true });
    });
  }

  // Wire up sort select if present
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', function(){
      const v = sortSelect.value;
      const products = window.tvProducts || [];
      let sorted = products.slice();
      if (v === 'Price: Low to High') sorted.sort((a,b) => (a.price||0) - (b.price||0));
      else if (v === 'Price: High to Low') sorted.sort((a,b) => (b.price||0) - (a.price||0));
      else sorted = products; // Newest is default order
      renderTVs(sorted);
    });
  }

  // Initialize
  try {
    const products = await fetchTVProducts();
    window.tvProducts = products;
    renderTVs(products);
  } catch (e) {
    console.error('[tvs] Error loading products:', e);
    const grid = document.getElementById('tvsGrid');
    if (grid) grid.innerHTML = '<div class="ap-error">Failed to load TV products.</div>';
  }

})();