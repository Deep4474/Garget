(async function(){
  // show only phones by querying products table for "phone" in category or name
  // Prefer querying the dedicated Supabase project for products (new project)
  // to ensure phones are pulled from the right database. Fallback to the
  // global `window.supabaseClient` if REST/SDK calls to the dedicated project
  // fail.
  const PHONE_SUPABASE_URL = 'https://ahzfkfxqtdtkrwlxvimp.supabase.co';
  const PHONE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoemZrZnhxdGR0a3J3bHh2aW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcyMDksImV4cCI6MjA3NzM5MzIwOX0.us--sBWAKTPJrd4gPKMPLBgtkJVhAcrUEQoD9YTnJww';
  const PHONE_REST_BASE = String(PHONE_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1';
  async function fetchPhoneProducts() {
    const client = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
  const tables = ['products'];
  const _tableExistsCache = {};
  async function tableExists(client, table) {
    if (!table) return false;
    if (Object.prototype.hasOwnProperty.call(_tableExistsCache, table)) return _tableExistsCache[table];

    // Try REST probe first to detect a missing table (HTTP 404) without letting
    // the Supabase SDK generate noisy REST calls that appear in the console.
    // Use HEAD where supported (lighter, less noisy). If HEAD is not allowed
    // fall back to GET. Any client 4xx (except auth errors) is treated
    // conservatively as "table likely missing" to avoid noisy queries.
    try {
      // Prefer the dedicated project REST endpoint for phone queries.
      const base = String(PHONE_SUPABASE_URL || window.SUPABASE_URL || '').replace(/\/$/, '');
      const key = PHONE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || '';
      if (base && key) {
        const url = `${base}/rest/v1/${encodeURIComponent(table)}?select=id&limit=1`;
        try {
          // Prefer HEAD (some servers support it and it's lighter)
          let headRes = null;
          try {
            headRes = await fetch(url, { method: 'HEAD', headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
          } catch (headErr) {
            headRes = null; // network/CORS or HEAD not allowed
          }

          if (headRes) {
            if (headRes.status === 404) { _tableExistsCache[table] = false; return false; }
            if (headRes.ok || headRes.status === 204) {
              // REST probe claims the table exists — if we have an SDK client,
              // double-check with a lightweight SDK probe to avoid false positives
              if (client && typeof client.from === 'function') {
                try {
                  const sdkProbe = await client.from(table).select('id').limit(1);
                  if (sdkProbe && sdkProbe.error) { _tableExistsCache[table] = false; return false; }
                  _tableExistsCache[table] = true; return true;
                } catch (e) {
                  // SDK probe failed (network/CORS) — conservatively treat as missing
                  _tableExistsCache[table] = false; return false;
                }
              }
              _tableExistsCache[table] = true; return true;
            }
            // treat other client 4xx conservatively as missing unless it's a
            // method-not-allowed (fall through to GET) or auth (401/403)
            if (headRes.status !== 405 && headRes.status !== 501 && (headRes.status >= 400 && headRes.status < 500) && headRes.status !== 401 && headRes.status !== 403) { _tableExistsCache[table] = false; return false; }
          }

          // HEAD not conclusive — try GET as fallback
          const res = await fetch(url, { method: 'GET', headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Accept': 'application/json' } });
          if (res.status === 404) {
            // Helpful debug: include URL so developer can quickly diagnose wrong table or project
            try { const body = await res.text(); console.warn(`Supabase REST probe: table "${table}" returned 404. URL=${url} body=${body}`); } catch (e) { console.warn(`Supabase REST probe: table "${table}" returned 404. URL=${url}`); }
            _tableExistsCache[table] = false; return false; }
          if (res.status >= 400 && res.status < 500 && res.status !== 200) {
            try { const body = await res.text(); console.warn(`Supabase REST probe: table "${table}" returned ${res.status}. URL=${url} body=${body}`); } catch (e) { console.warn(`Supabase REST probe: table "${table}" returned ${res.status}. URL=${url}`); }
            _tableExistsCache[table] = false; return false; }
          if (res.ok) {
            if (client && typeof client.from === 'function') {
              try {
                const sdkProbe = await client.from(table).select('id').limit(1);
                if (sdkProbe && sdkProbe.error) { _tableExistsCache[table] = false; return false; }
                _tableExistsCache[table] = true; return true;
              } catch (e) {
                _tableExistsCache[table] = false; return false;
              }
            }
            _tableExistsCache[table] = true; return true;
          }
        } catch (fetchErr) {
          // network/CORS issue — fall back to SDK probe below
        }
      }
    } catch (e) {
      // ignore and fall through to SDK probe
    }

    // Fallback: use SDK probe if available
    if (client && typeof client.from === 'function') {
      try {
        const probe = await client.from(table).select('id').limit(1);
        if (probe && probe.error) {
          const msg = String(probe.error.message || '').toLowerCase();
          if (probe.error.code === 'PGRST205' || /does not exist/.test(msg) || /relation ""/.test(msg)) { _tableExistsCache[table] = false; return false; }
        }
        _tableExistsCache[table] = true; return true;
      } catch (e) { _tableExistsCache[table] = false; return false; }
    }

    _tableExistsCache[table] = false; return false;
  }
  const searchFields = ['category','categories','type','tags','name','title'];
    const results = [];
  const effectiveTables = [];
  for (const t of tables) { try { if (await tableExists(client, t)) effectiveTables.push(t); } catch(e){} }
  for (const t of effectiveTables) {
      try {
        if (client && typeof client.from === 'function') {
          // Probe one row to learn which fields exist in this table and detect array-typed fields
          // Known common array-like fields (avoid ilike on these when probe fails)
          const knownArrayFields = new Set(['tags','images','image_urls','image_urls','categories','variants','attributes']);
          let presentFields = new Set();
          let arrayFields = new Set();
          try {
            const sample = await client.from(t).select('*').limit(1);
            if (sample && !sample.error && Array.isArray(sample.data) && sample.data.length) {
              const first = sample.data[0] || {};
              Object.keys(first).forEach(k => {
                presentFields.add(k);
                try {
                  if (Array.isArray(first[k])) arrayFields.add(k);
                } catch (e) {}
              });
            }
          } catch (probeErr) {
            // probing failed; leave presentFields empty and fall back to safe attempts
          }

          // Only attempt ilike on fields that actually exist AND are not array-typed (ilike doesn't work on text[])
          let pushed = false;
          // Avoid trying known array-like names (tags, images etc.) or any detected array-typed fields
          let fieldsToTry = searchFields.filter(f => (presentFields.size === 0 || presentFields.has(f)) && !knownArrayFields.has(f) && !arrayFields.has(f));
          // If a flattened server-side column exists, prefer it. Place tags_text before tags.
          try {
            if (presentFields.size === 0 || presentFields.has('tags_text')) {
              if (fieldsToTry.indexOf('tags_text') !== -1) {
                fieldsToTry = ['tags_text'].concat(fieldsToTry.filter(f => f !== 'tags_text'));
              }
            }
          } catch (e) { /* ignore */ }
          for (const f of fieldsToTry) {
            try {
              const q = await client.from(t).select('*').ilike(f, '%phone%').limit(500);
              if (q && q.error) {
                // SDK returned an error for this field — log details to help debugging (404s, 400s, permission issues)
                console.warn(`Supabase SDK query error on table="${t}" field="${f}":`, q.error);
              }
              if (q && !q.error && Array.isArray(q.data) && q.data.length) {
                // tag each row with the source table so we can render "Share" for product5
                q.data.forEach(row => { try { row.__table = t; } catch (e) {} ; results.push(row); });
                pushed = true;
                break;
              }
              // if server returned error for this field, ignore and continue
            } catch (err) {
              // log unexpected network/exception errors for better diagnostics
              console.warn(`Supabase SDK unexpected error querying table="${t}" field="${f}":`, err && err.message ? err.message : err);
              // ignore and try next field
            }
          }

          // If nothing found with server-side filters, fallback to server-side name search (non-array)
          if (!pushed && (presentFields.size === 0 || presentFields.has('name')) && !arrayFields.has('name')) {
            try {
              const r2 = await client.from(t).select('*').ilike('name', '%phone%').limit(500);
              if (r2 && !r2.error && Array.isArray(r2.data)) {
                r2.data.forEach(row => { try { row.__table = t; } catch(e){}; results.push(row); });
                pushed = true;
              }
            } catch(e) { console.warn(`Name ilike fallback failed on table="${t}":`, e && e.message ? e.message : e); }
          }

          // If we still haven't found matches and there are array-typed fields (e.g. tags TEXT[]),
          // fetch a permissive set and filter client-side for substring matches inside array elements.
          if (!pushed && arrayFields.size > 0) {
            try {
              const r3 = await client.from(t).select('*').limit(500);
              if (r3 && !r3.error && Array.isArray(r3.data) && r3.data.length) {
                const needle = 'phone';
                r3.data.forEach(row => {
                  try {
                    let matched = false;
                    for (const af of Array.from(arrayFields)) {
                      const val = row[af];
                      if (!val) continue;
                      if (Array.isArray(val)) {
                        for (const el of val) {
                          try {
                            if (typeof el === 'string' && el.toLowerCase().includes(needle)) { matched = true; break; }
                            // if el is object, try common string-ish properties
                            if (el && typeof el === 'object') {
                              for (const prop of ['name','title','label']) {
                                if (el[prop] && typeof el[prop] === 'string' && el[prop].toLowerCase().includes(needle)) { matched = true; break; }
                              }
                              if (matched) break;
                            }
                          } catch(e){}
                        }
                      }
                      if (matched) break;
                    }
                    if (matched) { try { row.__table = t; } catch(e){}; results.push(row); }
                  } catch(e){}
                });
              }
            } catch(e) { console.warn(`Array-field client-side filter failed on table="${t}":`, e && e.message ? e.message : e); }
          }
        } else {
          // fallback to REST — prefer the phones project's REST endpoint
            const base = PHONE_REST_BASE || String(window.SUPABASE_URL || '').replace(/\/$/, '');
            const key = PHONE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || '';
            if (base && key) {
              const res = await fetch(`${base}/${t}?select=*&or=(category.ilike.*phone*,name.ilike.*phone*)`, {
                headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
              });
            if (res.ok) {
              const d = await res.json();
              if (Array.isArray(d)) {
                d.forEach(row => { try { row.__table = t; } catch(e){}; results.push(row); });
              }
            }
          }
        }
      } catch (e) { /* ignore individual table failures */ }
    }
    return results.map(r => {
      // Try to preserve which table the row came from if available (some SDK results include __table or similar)
      const src = (r && r.__source) || (r && r.__table) || null;
      return {
        id: r.id || r.product_id || (r.name && r.name.replace(/\s+/g,'-').toLowerCase()),
        name: r.name || r.title || r.product_name || r.product || '',
        price: r.price || r.amount || r.product_price || 0,
        image_url: r.image_url || r.image || r.photo || (Array.isArray(r.images) && r.images[0]) || '',
        _raw: r,
        __src: src || null
      };
    });
  }

  function renderPhones(products) {
    const grid = document.getElementById('phonesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    products.forEach(p => {
      const el = document.createElement('article');
      el.className = 'product-card';
      const pid = p.id || (p.name && p.name.replace(/\s+/g,'-').toLowerCase()) || '';
      el.setAttribute('data-product-id', pid);
      el.setAttribute('data-slug', pid);

  // compute image and href; always use product.html for products table
  const imgSrc = p.image_url || 'assets/images/smartphone.png';
  const productHref = p.id ? ('product.html?id=' + encodeURIComponent(p.id)) : '#';
      el.setAttribute('data-href', productHref);
      el.setAttribute('data-image', imgSrc);

      el.innerHTML = `
        <a class="product-link" href="${productHref}">
          <div class="product-overlay">
            <button class="icon-btn heart" data-action="wishlist" title="Add to wishlist">❤</button>
            <button class="icon-btn compare" data-action="compare" title="Compare">⇄</button>
          </div>
          <img class="product-img" src="${imgSrc}" alt="${(p.name||'').replace(/"/g,'&quot;')}" />
          <div class="product-name">${p.name}</div>
          <div class="price">${typeof p.price === 'number' ? '₦' + p.price.toLocaleString() : p.price}</div>
            <div class="product-addbar" data-action="addbar"><span class="add-text">Add to cart</span></div>
            <div class="product-card-actions"></div>
        </a>
      `;

      // touch handler: first tap shows overlay, second tap navigates using data-href
      (function(card){
        let lastTouch = 0;
        card.addEventListener('touchstart', function(e){
          if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar')) return;
          const now = Date.now();
          if (lastTouch && (now - lastTouch) < 800) {
            const href = card.getAttribute('data-href') || '#';
            if (href) { window.location.href = href; return; }
          }
          // show overlay
          document.querySelectorAll('.product-card.touch-hover').forEach(c => c.classList.remove('touch-hover'));
          card.classList.add('touch-hover');
          lastTouch = now;
        }, { passive: true });
      })(el);

      grid.appendChild(el);
    });
    // expose current phones for other scripts (add-to-cart lookup)
    window.products = products;
  // No delegated share-product handler — all products cards use product.html
  }

  // init
  try {
    const products = await fetchPhoneProducts();
    renderPhones(products);
  } catch (e) {
    console.error('phones page load failed', e);
  }

})();
