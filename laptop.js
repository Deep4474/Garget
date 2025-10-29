(function(){
  // Use laptopsGrid for laptop products
  const grid = document.getElementById('laptopsGrid');

  // Enable on-page debug panel to inspect table fields and match counts
  // Set to false to hide the panel in production
  const ENABLE_LAPTOP_DEBUG = false;

  // Ensure a supabase client exists similar to categories.js behavior
  if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      try {
        window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        console.debug('[laptop] created window.supabaseClient from SUPABASE_* globals');
      } catch (e) {
        console.warn('[laptop] failed to create supabase client:', e && e.message ? e.message : e);
      }
    }
  }

  function showDebugPanel(stats) {
    if (!ENABLE_LAPTOP_DEBUG) return;
    let panel = document.getElementById('laptopDebugPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'laptopDebugPanel';
      panel.style.position = 'fixed';
      panel.style.right = '12px';
      panel.style.bottom = '12px';
      panel.style.maxWidth = '380px';
      panel.style.maxHeight = '40vh';
      panel.style.overflow = 'auto';
      panel.style.background = 'rgba(0,0,0,0.78)';
      panel.style.color = 'white';
      panel.style.fontSize = '12px';
      panel.style.padding = '8px';
      panel.style.zIndex = 99999;
      panel.style.borderRadius = '6px';
      panel.innerHTML = '<strong>laptop debug</strong><div id="laptopDebugContent"></div>';
      document.body.appendChild(panel);
    }
    const c = document.getElementById('laptopDebugContent');
    if (!c) return;
    c.innerHTML = '';
    for (const t in stats) {
      const s = stats[t];
      const el = document.createElement('div');
      el.style.marginBottom = '8px';
      el.innerHTML = `<div style="font-weight:600">${t}</div>
        <div style="font-size:12px">server matches: ${s.server} &nbsp; client-filter: ${s.clientFiltered} &nbsp; heuristic: ${s.heuristic}</div>
        <div style="font-size:11px;color:#ddd;margin-top:4px">fields: ${Array.isArray(s.presentFields)? s.presentFields.join(', ') : ''}</div>`;
      c.appendChild(el);
    }
  }

  function formatPrice(v){
    const n = Number(v);
    if (!isFinite(n)) return '';
    return new Intl.NumberFormat('en-NG',{ style: 'currency', currency: 'NGN' }).format(n);
  }

  // Strict category-based matcher for laptops
  function matchesLaptop(row) {
    if (!row || typeof row !== 'object') return false;
    const CATEGORY_FIELDS = ['category','categories','category_name','cat','type','tags'];
    const LAPTOP_KEYWORDS = ['laptop','laptops','macbook','notebook','notebooks','chromebook'];
    const name = (row.name || row.title || row.product_name || '').toString().toLowerCase();
    for (const kw of LAPTOP_KEYWORDS) if (name.includes(kw)) return true;
    for (const f of CATEGORY_FIELDS) {
      if (!row.hasOwnProperty(f)) continue;
      const v = row[f];
      if (!v) continue;
      if (typeof v === 'string' && LAPTOP_KEYWORDS.some(kw => v.toLowerCase().includes(kw))) return true;
      if (Array.isArray(v) && LAPTOP_KEYWORDS.some(kw => v.join(' ').toLowerCase().includes(kw))) return true;
    }
    return false;
  }

  function render(products){
    if (!grid) return;
    if (!Array.isArray(products) || products.length === 0) {
      grid.innerHTML = '<div class="ap-loading">No laptops found.</div>';
      return;
    }
    // dedupe by id or by title
    const seen = new Set();
    const rows = [];
    for (const p of products) {
      const id = String(p.id || p.slug || (p.name && p.name.trim().toLowerCase()) || '').trim();
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(p);
    }

    grid.innerHTML = rows.map(p => {
      const img = p.image_url || p.image || 'assets/images/laptop.png';
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
          <div class="product-thumb-wrap"><img class="product-img product-thumb" src="${img}" alt="${title}" onerror="this.onerror=null;this.src='assets/images/laptop.png'" /></div>
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
          // navigate to the computed href (product page or new-product preview)
          window.location.href = href;
        }
      });
    });

    // No delegated share-product handler: product5 cards navigate to new-product.html via data-href
  }

  async function loadLaptops(){
    // Prefer supabase client if available
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      try {
        // No explicit product5 table probe — prefer main tables only
        let rows = [];

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
    const effectiveTables = [];
    for (const t of tables) { try { if (await tableExists(window.supabaseClient, t)) effectiveTables.push(t); } catch(e){} }
    const candidateFields = ['category','categories','category_name','cat','type','tags'];

    for (const t of effectiveTables) {
          // probe for a sample row to learn which fields exist and detect array-typed fields
          const knownArrayFields = new Set(['tags','images','image_urls','categories','variants','attributes']);
          let presentFields = new Set();
          let arrayFields = new Set();
          try {
            const sample = await window.supabaseClient.from(t).select('*').limit(1);
            if (!sample.error && Array.isArray(sample.data) && sample.data.length) {
              const first = sample.data[0] || {};
              Object.keys(first).forEach(k => {
                presentFields.add(k);
                try { if (Array.isArray(first[k])) arrayFields.add(k); } catch (e) {}
              });
            }
          } catch (e) {
            // ignore probe failures; we'll use safe defaults
          }

          // prefer server-side flattened column if present (tags_text)
          const serverPrefer = (presentFields.size === 0 || presentFields.has('tags_text')) ? ['tags_text'] : [];

          // candidate fields to attempt server-side ilike: present and not array-typed and not known array names
          const candidatePresent = candidateFields.filter(f => presentFields.has(f) && !arrayFields.has(f) && !knownArrayFields.has(f));
          const fieldsToTry = serverPrefer.concat(candidatePresent);

          if (fieldsToTry.length) {
            for (const field of fieldsToTry) {
              for (const kw of ['laptop','laptops','macbook','notebook','chromebook']) {
                try {
                  const res = await window.supabaseClient.from(t).select('*').ilike(field, `%${kw}%`).limit(1000);
                  if (res && res.error) {
                    // log field-specific SDK errors (helps spot operator / type issues)
                    console.warn(`[laptop] supabase query error table=${t} field=${field}:`, res.error);
                  }
                  if (res && !res.error && Array.isArray(res.data) && res.data.length) rows = rows.concat(res.data.map(r => Object.assign({}, r, { __source: t, __table: t })));
                } catch (e) {
                  // ignore per-field network/exception errors
                }
              }
            }
          }
        }

        // dedupe rows by id or title (stringified key) and include source
        const seenRow = new Set();
        const unique = [];
        for (const r of (rows || [])) {
          const idCandidate = r.id || r.product_id || r.uuid || r.sku || null;
          const nameCandidate = r.name || r.title || (r.product && String(r.product)) || '';
          const key = idCandidate ? (String(idCandidate) + '|' + (r.__source || '')) : (String((nameCandidate || '').trim().toLowerCase()) + '|' + (r.__source || ''));
          if (!key) continue;
          if (seenRow.has(key)) continue;
          seenRow.add(key);
          unique.push(r);
        }

        if (!unique.length) {
          grid.innerHTML = '<div class="ap-loading">No laptops found (no category matches).</div>';
          return;
        }

        const normalized = unique.map(r => ({ id: (r.__source ? (r.__source + '|' + (r.id || r.product_id || r.uuid || '')) : (r.id || r.product_id || r.uuid)), name: r.name || r.title || r.product_name || r.product, price: r.price || r.amount || r.unit_price, image_url: r.image_url || r.image || (Array.isArray(r.images) && r.images[0]) || r.photo, slug: r.slug || r.handle || r.id, source: r.__source }));
        window.laptopProducts = normalized;
        render(normalized);
        return;
      } catch (e) {
        console.warn('laptop.js supabase load failed', e);
      }
    }

    // fallback mock data
    const mock = [
      { id: 'l1', name: 'Dell Inspiron 15', price: 250000, image_url: 'assets/images/laptop.png' },
      { id: 'l2', name: 'HP Pavilion 14', price: 210000, image_url: 'assets/images/laptop2.png' },
      { id: 'l3', name: 'Lenovo IdeaPad 3', price: 180000, image_url: 'assets/images/laptop3.png' }
    ];
    render(mock);
  }

  // wire sort select
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', function(){
      const v = sortSelect.value;
      const products = window.laptopProducts || [];
      let sorted = products.slice();
      if (v === 'Price: Low to High') sorted.sort((a,b) => (a.price||0) - (b.price||0));
      else if (v === 'Price: High to Low') sorted.sort((a,b) => (b.price||0) - (a.price||0));
      else sorted = products; // Newest is default order
      render(sorted);
    });
  }

  // initial load: if the document is already interactive/complete, run now, otherwise listen
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // short timeout to allow other scripts to initialize (like supabase-config)
    setTimeout(() => { loadLaptops().catch(()=>{}); }, 8);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ loadLaptops().catch(()=>{}); });
  }
})();
