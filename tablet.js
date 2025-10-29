// Improved tablet loader: queries both `products` and `product2` and uses safe probing + heuristics
(function(){
  const grid = document.getElementById('tabletsGrid') || document.getElementById('phonesGrid');

  // ensure supabase client exists (reuse global pattern)
  if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      try { window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); } catch(e){}
    }
  }

  function formatPrice(v){
    const n = Number(v);
    if (!isFinite(n)) return '';
    return new Intl.NumberFormat('en-NG',{ style: 'currency', currency: 'NGN' }).format(n);
  }

  const CATEGORY_FIELDS = ['category','categories','category_name','cat','type','tags'];
  const TABLET_KEYWORDS = ['tablet','tablets','ipad','tab','galaxy tab','ipad pro'];

  function matchesTablet(row) {
    if (!row || typeof row !== 'object') return false;
    const name = (row.name || row.title || row.product_name || '').toString().toLowerCase();
    for (const kw of TABLET_KEYWORDS) if (name.includes(kw)) return true;
    for (const f of CATEGORY_FIELDS) {
      if (!row.hasOwnProperty(f)) continue;
      const v = row[f];
      if (!v) continue;
      if (typeof v === 'string' && TABLET_KEYWORDS.some(kw => v.toLowerCase().includes(kw))) return true;
      if (Array.isArray(v) && TABLET_KEYWORDS.some(kw => v.join(' ').toLowerCase().includes(kw))) return true;
    }
    return false;
  }

  function render(products){
    if (!grid) return;
    if (!Array.isArray(products) || products.length === 0) {
      grid.innerHTML = '<div class="ap-loading">No tablets found.</div>';
      return;
    }

    // dedupe for this render pass (prefer stable id, else name+source)
    const seen = new Set();
    const rows = [];
    for (const p of products) {
      const idKey = p.id || p.product_id || p.uuid || null;
      const nameKey = (p.name || p.title || '').trim().toLowerCase();
      const key = idKey ? (String(idKey) + '|' + (p.__source || '')) : (nameKey + '|' + (p.__source || ''));
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(p);
    }

    grid.innerHTML = rows.map(p => {
      const img = p.image_url || p.image || 'assets/images/tablet.png';
      const title = (p.name || p.title || p.product_name || 'Untitled').replace(/</g,'&lt;');
      const price = formatPrice(p.price || p.amount || 0);
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
          <div class="product-thumb-wrap"><img class="product-img" src="${img}" alt="${title}" onerror="this.onerror=null;this.src='assets/images/tablet.png'" /></div>
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

    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', function(e){
        // ignore clicks on overlay controls or addbar so these do not navigate
        if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar')) return;
        const href = card.getAttribute('data-href');
        if (href) {
          window.location.href = href;
        }
      });
    });

    // No delegated share-product handler: product5 cards navigate to new-product via data-href
  }

  async function loadTablets(){
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      try {
  const tables = ['product5','products','product2'];
  const _tableExistsCache = {};
  async function tableExists(client, table) {
    if (!client || typeof client.from !== 'function') return false;
    if (_tableExistsCache.hasOwnProperty(table)) return _tableExistsCache[table];
    try {
      const probe = await client.from(table).select('id').limit(1);
      if (probe && probe.error) {
        const msg = String(probe.error.message || '').toLowerCase();
        if (probe.error.code === 'PGRST205' || /does not exist/.test(msg)) { _tableExistsCache[table] = false; return false; }
      }
      _tableExistsCache[table] = true; return true;
    } catch(e) { _tableExistsCache[table] = false; return false; }
  }
        const candidateFields = ['category','categories','category_name','cat','type','tags'];
        let rows = [];

  const effectiveTables = [];
  for (const t of tables) { try { if (await tableExists(window.supabaseClient, t)) effectiveTables.push(t); } catch(e){} }
  for (const t of effectiveTables) {
          // probe present fields and detect array-typed fields to avoid using .ilike on arrays
          const knownArrayFields = new Set(['tags','images','image_urls','categories','variants','attributes']);
          let presentFields = new Set();
          let arrayFields = new Set();
          try {
            const sample = await window.supabaseClient.from(t).select('*').limit(1);
            if (!sample.error && Array.isArray(sample.data) && sample.data.length) {
              const first = sample.data[0] || {};
              Object.keys(first).forEach(k => {
                presentFields.add(k);
                try { if (Array.isArray(first[k])) arrayFields.add(k); } catch(e){}
              });
            }
          } catch(e){}

          // prefer server-side flattened column if present (tags_text), avoid known array-like fields
          const serverPrefer = (presentFields.size === 0 || presentFields.has('tags_text')) ? ['tags_text'] : [];
          const candidatePresent = candidateFields.filter(f => presentFields.has(f) && !arrayFields.has(f) && !knownArrayFields.has(f));
          const fieldsToTry = serverPrefer.concat(candidatePresent);
          if (fieldsToTry.length) {
            for (const field of fieldsToTry) {
              for (const kw of TABLET_KEYWORDS) {
                try {
                  const res = await window.supabaseClient.from(t).select('*').ilike(field, `%${kw}%`).limit(1000);
                  if (res && res.error) {
                    console.warn(`[tablet] supabase query error table=${t} field=${field}:`, res.error);
                  }
                  if (res && !res.error && Array.isArray(res.data) && res.data.length) rows = rows.concat(res.data.map(r => Object.assign({}, r, { __source: t, __table: t })));
                } catch(e) {
                  // ignore network/other errors per-field
                }
              }
            }
          }
        }

        // dedupe by id+source and normalize
        const seen = new Set();
        const unique = [];
        for (const r of rows) {
          const idKey = r.id || r.product_id || r.uuid || null;
          const nameKey = (r.name || r.title || '').trim().toLowerCase();
          const key = idKey ? (String(idKey) + '|' + (r.__source||'')) : (nameKey + '|' + (r.__source||''));
          if (!key) continue;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(r);
        }

        if (!unique.length) {
          grid.innerHTML = '<div class="ap-loading">No tablets found (no category matches).</div>';
          return;
        }

        const normalized = unique.map(r => ({ id: (r.__source ? (r.__source + '|' + (r.id || r.product_id || r.uuid || '')) : (r.id || r.product_id || r.uuid)), name: r.name || r.title || r.product_name || r.product, price: r.price || r.amount || r.unit_price, image_url: r.image_url || r.image || (Array.isArray(r.images)&&r.images[0]) || r.photo, slug: r.slug || r.handle || r.id, source: r.__source }));
        window.products = normalized;
        render(normalized);
        return;
      } catch(e) { console.warn('tablet.js supabase load failed', e); }
    }

    // fallback mock
    const mock = [
      { id: 't1', name: 'Mock Tablet A', price: 120000, image_url: 'assets/images/tablet.png' },
      { id: 't2', name: 'Mock Tablet B', price: 180000, image_url: 'assets/images/tablet2.png' }
    ];
    render(mock);
  }

  // initial load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => { loadTablets().catch(()=>{}); }, 8);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ loadTablets().catch(()=>{}); });
  }
})();
