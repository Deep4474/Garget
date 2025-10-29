(function(){
  // Only target the accessories grid. Remove phonesGrid fallback to avoid showing phones here.
  const grid = document.getElementById('accessoriesGrid');

  // Defensive: wrap the global `renderProducts` so if other scripts call it on this
  // page (for example, a global renderer that doesn't know about accessories) we
  // intercept the array, filter to accessories/wearables and render locally.
  try {
    if (window && typeof window.renderProducts === 'function') {
      window._originalRenderProducts_for_accessories = window.renderProducts;
    }
  } catch (e) {}

  // Replace with a wrapper that forwards accessory/wearable product lists to our
  // local `render` function when on the accessories page. Otherwise call the
  // original renderer if available.
  window.renderProducts = function(products, categoryMap) {
    const isAccessoriesPage = !!document.getElementById('accessoriesGrid');
    if (!isAccessoriesPage) {
      if (window._originalRenderProducts_for_accessories && typeof window._originalRenderProducts_for_accessories === 'function') {
        return window._originalRenderProducts_for_accessories(products, categoryMap);
      }
      return;
    }

    // Normalize incoming array-like payloads
    const arr = Array.isArray(products) ? products : (window.products && Array.isArray(window.products) ? window.products : []);
    if (!arr.length) {
      // nothing to render
      grid && (grid.innerHTML = '<div class="ap-loading">No accessories found.</div>');
      return;
    }

    // Filter to accessories and wearables, and always exclude phones/laptops
    const filtered = arr.filter(p => {
      if (!p || typeof p !== 'object') return false;
      if (isPhoneOrLaptop(p)) return false;
      const name = (p.name || p.title || p.product_name || '').toString().toLowerCase();
      const isWearable = WEARABLE_KEYWORDS.some(k => name.includes(k));
      const isAccessoryName = ACCESSORY_KEYWORDS.some(k => name.includes(k));
      if (isWearable || isAccessoryName) return true;
      // also allow if category fields indicate accessory
      for (const f of CATEGORY_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(p, f)) continue;
        const v = p[f]; if (!v) continue;
        const str = Array.isArray(v) ? v.join(' ').toLowerCase() : String(v).toLowerCase();
        if (ACCESSORY_KEYWORDS.some(kw => str.includes(kw)) || WEARABLE_KEYWORDS.some(kw => str.includes(kw))) return true;
      }
      return false;
    });

    if (!filtered.length) {
      grid && (grid.innerHTML = '<div class="ap-loading">No accessories found.</div>');
      window.products = [];
      return;
    }

    window.products = filtered;
    render(filtered);
  };

  // Ensure the accessories grid is empty before our rendering runs
  if (grid) grid.innerHTML = '';

  function formatPrice(v){
    const n = Number(v);
    if (!isFinite(n)) return '';
    return new Intl.NumberFormat('en-NG',{ style: 'currency', currency: 'NGN' }).format(n);
  }

  const CATEGORY_FIELDS = ['category','categories','category_name','cat','type','tags'];
  const ACCESSORY_KEYWORDS = ['accessory','accessories','case','charger','power bank','headphone','earbud','screen guard','wear','wearable','watch','cable'];
  const WEARABLE_KEYWORDS = ['watch','earbud','earbuds','earphone','earphones','buds','smartwatch','fitness band','fitness tracker','tracker','wearable','ring','hearable','tws','true wireless'];

  // Exclude items that are clearly phones or laptops
  const PHONE_LAPTOP_KEYWORDS = [
    'phone', 'smartphone', 'mobile', 'laptop', 'notebook', 'iphone', 'macbook', 'samsung galaxy',
    'macbook pro', 'macbook air', 'imac', 'mac mini', 'mac pro',
    'galaxy book', 'dell', 'lenovo', 'thinkpad', 'ideapad', 'chromebook'
  ];

  const BRAND_BLACKLIST = ['apple', 'samsung', 'dell', 'lenovo', 'hp', 'asus', 'acer'].map(b => b.toLowerCase());

  function isPhoneOrLaptop(row) {
    if (!row || typeof row !== 'object') return false;
    const name = (row.name || row.title || row.product_name || '').toString().toLowerCase();
    
    // Check for blacklisted brands in product name
    if (BRAND_BLACKLIST.some(brand => name.includes(brand))) {
      // If it's a brand match, only exclude if it's not clearly an accessory
      if (!ACCESSORY_KEYWORDS.some(acc => name.includes(acc.toLowerCase()))) {
        return true;
      }
    }

    // Check for explicit phone/laptop keywords
    for (const kw of PHONE_LAPTOP_KEYWORDS) if (name.includes(kw)) return true;
    
    // Check category fields
    for (const f of CATEGORY_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(row, f)) continue;
      const v = row[f];
      if (!v) continue;
      const str = Array.isArray(v) ? v.join(' ').toLowerCase() : String(v).toLowerCase();
      for (const kw of PHONE_LAPTOP_KEYWORDS) if (str.includes(kw)) return true;
    }

    // Check product type/category
    const category = (row.type || row.category || '').toString().toLowerCase();
    if (category.includes('phone') || category.includes('laptop')) return true;

    // Check price range - most accessories are cheaper than phones/laptops
    const price = parseFloat(row.price || row.amount || 0);
    // If price is very high, likely a phone/laptop — but allow if the name/category clearly indicates an accessory (e.g., 'watch', 'earbud')
    if (price > 1000000) {
      const isAccessoryName = ACCESSORY_KEYWORDS.some(acc => name.includes(acc.toLowerCase()));
      if (!isAccessoryName) return true;
    }

    return false;
  }

  // Strict category-based matcher: only checks name/title and explicit category-like fields.
  function isAccessoryByCategory(row) {
    if (!row || typeof row !== 'object') return false;
    const name = (row.name || row.title || row.product_name || '').toString().toLowerCase();
    for (const kw of ACCESSORY_KEYWORDS) if (name.includes(kw)) return true;
    for (const f of CATEGORY_FIELDS) {
      if (!row.hasOwnProperty(f)) continue;
      const v = row[f];
      if (!v) continue;
      if (typeof v === 'string' && ACCESSORY_KEYWORDS.some(kw => v.toLowerCase().includes(kw))) return true;
      if (Array.isArray(v) && ACCESSORY_KEYWORDS.some(kw => v.join(' ').toLowerCase().includes(kw))) return true;
    }
    return false;
  }

  function render(products){
    if (!grid) return;
    if (!Array.isArray(products) || products.length === 0) {
      grid.innerHTML = '<div class="ap-loading">No accessories found.</div>';
      return;
    }
    // Filter out phones and laptops
    products = products.filter(p => !isPhoneOrLaptop(p));
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
      const img = p.image_url || p.image || 'assets/images/appliances.png';
      const title = (p.name || p.title || p.product_name || 'Untitled').replace(/</g,'&lt;');
      const price = formatPrice(p.price || p.amount || 0);
      const slug = p.slug || p.id || '';
      const pid = p.id || p.product_id || slug || '';
      const isProduct5 = (p.__source === 'product5' || p.__table === 'product5' || p.source === 'product5');
      const productHref = isProduct5 ? ('new-product.html' + (img ? ('?image_url=' + encodeURIComponent(img) + '&name=' + encodeURIComponent(p.name || '')) : '')) : ('product.html' + (slug ? ('?id=' + encodeURIComponent(slug)) : ''));
      return `
        <article class="product-card" data-product-id="${pid}" data-slug="${slug}" data-href="${productHref}">
          <div class="product-overlay">
            <button class="icon-btn heart" data-action="wishlist" title="Add to wishlist">❤</button>
            <button class="icon-btn compare" data-action="compare" title="Compare">⇄</button>
          </div>
          <img class="product-img" src="${img}" alt="${title}" onerror="this.onerror=null;this.src='assets/images/appliances.png'" />
          <h3 class="product-name">${title}</h3>
          <div class="price">${price}</div>
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
        if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar')) return;
        const href = card.getAttribute('data-href');
        if (href) window.location.href = href;
      });
    });

    // No delegated share-product handler: product5 cards navigate via data-href
  }

  async function loadAccessories(){
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      try {
  // prioritize product2 so its accessories and wearables show up first
  const tables = ['product2','product5','products'];
  // extra wearable-specific keywords to ensure wearables are included
  const WEARABLE_KEYWORDS = ['watch','earbud','earbuds','earphone','earphones','buds','smartwatch','fitness band','fitness tracker','tracker','wearable','ring','hearable'];
        // helper: check whether a table exists (cache results)
        // This uses a REST probe first (checks HTTP status) which is a reliable way
        // to detect a missing table (404) without letting the Supabase SDK generate
        // noisy REST calls that show up as 404 in the console. Falls back to SDK probe.
        const _tableExistsCache = {};
        async function tableExists(client, table) {
          if (!table) return false;
          if (Object.prototype.hasOwnProperty.call(_tableExistsCache, table)) return _tableExistsCache[table];

          // Try REST probe first if SUPABASE_URL and key are available
          try {
            const base = String(window.SUPABASE_URL || '').replace(/\/$/, '');
            const key = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || '';
            if (base && key) {
                const url = `${base}/rest/v1/${encodeURIComponent(table)}?select=id&limit=1`;
                try {
                  // Prefer HEAD probe first (lighter). If HEAD not allowed or fails,
                  // fall back to GET. Treat client 4xx conservatively as missing.
                  let headRes = null;
                  try {
                    headRes = await fetch(url, { method: 'HEAD', headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
                  } catch (headErr) {
                    headRes = null; // network/CORS or HEAD not supported
                  }

                  if (headRes) {
                    if (headRes.status === 404) { _tableExistsCache[table] = false; return false; }
                    if (headRes.ok || headRes.status === 204) {
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
                    if (headRes.status !== 405 && headRes.status !== 501 && (headRes.status >= 400 && headRes.status < 500) && headRes.status !== 401 && headRes.status !== 403) { _tableExistsCache[table] = false; return false; }
                  }

                  // HEAD inconclusive — try GET
                  const res = await fetch(url, { method: 'GET', headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Accept': 'application/json' } });
                  if (res.status === 404) { _tableExistsCache[table] = false; return false; }
                  if (res.status >= 400 && res.status < 500 && res.status !== 200) { _tableExistsCache[table] = false; return false; }
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
                  // otherwise fallthrough to SDK probe
                } catch (fetchErr) {
                  // network error or CORS — fall through to SDK probe
                }
            }
          } catch (e) {
            // ignore and fall back to SDK probe
          }

          // Fallback: use SDK probe if available
          if (client && typeof client.from === 'function') {
            try {
              const probe = await client.from(table).select('id').limit(1);
              if (probe && probe.error) {
                const msg = String(probe.error.message || '').toLowerCase();
                if (probe.error.code === 'PGRST205' || /does not exist/.test(msg) || /relation ""/.test(msg)) {
                  _tableExistsCache[table] = false; return false;
                }
              }
              _tableExistsCache[table] = true; return true;
            } catch (e) {
              _tableExistsCache[table] = false; return false;
            }
          }

          _tableExistsCache[table] = false; return false;
        }
        let rows = [];

        // Only query tables that appear to exist to reduce 404 noise
        const effectiveTables = [];
        for (const t of tables) {
          try { if (await tableExists(window.supabaseClient, t)) effectiveTables.push(t); } catch(e) {}
        }
        for (const t of effectiveTables) {
          // probe present category-like fields
          let presentFields = new Set();
          try {
            const sample = await window.supabaseClient.from(t).select('*').limit(1);
            if (!sample.error && Array.isArray(sample.data) && sample.data.length) Object.keys(sample.data[0]).forEach(k=>presentFields.add(k));
          } catch(e){}

          // If table has explicit category/tag fields, use server-side ilike on those only.
          // Detect array-typed fields and avoid running .ilike against them (Postgres text[] doesn't support ilike).
          const knownArrayFields = new Set(['tags','images','image_urls','categories','variants','attributes']);
          let arrayFields = new Set();
          try {
            const sample = await window.supabaseClient.from(t).select('*').limit(1);
            if (!sample.error && Array.isArray(sample.data) && sample.data.length) {
              const first = sample.data[0] || {};
              Object.keys(first).forEach(k => { try { if (Array.isArray(first[k])) arrayFields.add(k); } catch(e){} });
            }
          } catch(e) {}

          // prefer server-side flattened column if present (tags_text)
          const serverPrefer = (presentFields.size === 0 || presentFields.has('tags_text')) ? ['tags_text'] : [];
          const candidatePresent = CATEGORY_FIELDS.filter(f => presentFields.has(f) && !arrayFields.has(f) && !knownArrayFields.has(f));
          const fieldsToTry = serverPrefer.concat(candidatePresent);
          if (fieldsToTry.length) {
            for (const f of fieldsToTry) {
              for (const kw of ACCESSORY_KEYWORDS) {
                try {
                  const res = await window.supabaseClient.from(t).select('*').ilike(f, `%${kw}%`).limit(1000);
                  if (res && res.error) {
                    console.warn(`[accessories] supabase query error table=${t} field=${f}:`, res.error);
                  }
                  if (res && !res.error && Array.isArray(res.data) && res.data.length) rows = rows.concat(res.data.map(r=>Object.assign({}, r, { __source: t, __table: t })));
                } catch(e) {
                  // ignore per-field errors
                }
              }
            }
          }
        }

        // If we didn't find any rows via per-field server-side ilike, try a safer
        // name/title fallback search (useful for tables like `product2` that may
        // not expose flattened category fields). This searches common text fields
        // for accessory and wearable keywords.
        if (!rows.length) {
          const fallbackFields = ['name','title','product_name','description'];
          const fallbackKeywords = ACCESSORY_KEYWORDS.concat(WEARABLE_KEYWORDS);
          for (const t of effectiveTables) {
            for (const f of fallbackFields) {
              for (const kw of fallbackKeywords) {
                try {
                  const res = await window.supabaseClient.from(t).select('*').ilike(f, `%${kw}%`).limit(1000);
                  if (res && !res.error && Array.isArray(res.data) && res.data.length) rows = rows.concat(res.data.map(r=>Object.assign({}, r, { __source: t, __table: t })));
                } catch (e) {
                  // ignore errors for missing fields or other issues
                }
              }
            }
          }
        }

        // dedupe & normalize, excluding phones/laptops
        const seen = new Set(); const unique = [];
        for (const r of rows) {
          // skip phone or laptop rows
          if (isPhoneOrLaptop(r)) continue;
          const key = String(r.id || r.product_id || (r.name||'').trim().toLowerCase()||'') + '|' + (r.__source||'');
          if (!key) continue; if (seen.has(key)) continue; seen.add(key); unique.push(r);
        }
        if (!unique.length) {
          // no explicit category matches found — show none (strict category-only behavior)
          grid.innerHTML = '<div class="ap-loading">No accessories found (no category matches).</div>';
          return;
        }
  const normalized = unique.map(r=>({ id: r.id||r.product_id||r.uuid, name: r.name||r.title||r.product_name||r.product||'', price: r.price||r.amount||r.unit_price, image_url: r.image_url||r.image||(Array.isArray(r.images)&&r.images[0])||r.photo, slug: r.slug||r.handle||r.id, source: r.__source || r.__table || r.source }));
        // Final defensive filter: remove any remaining phones/laptops before exposing to UI
        const finalList = normalized.filter(n => !isPhoneOrLaptop(n));
        // If everything was filtered out, show a friendly message instead of rendering phone/laptop items
        if (!finalList.length) {
          grid.innerHTML = '<div class="ap-loading">No accessories found.</div>';
          window.products = [];
          return;
        }
        window.products = finalList; render(finalList); return;
      } catch(e){ console.warn('accessories.js supabase failed', e); }
    }
    // if supabase not configured show mock as fallback
    const mock = [ { id:'a1', name:'Mock Charger', price:4500, image_url:'assets/images/appliances.png' } ]; render(mock);
  }

  let hasLoaded = false;
  function initializeOnce() {
    if (hasLoaded) return;
    hasLoaded = true;
    loadAccessories().catch(() => {});
  }
  
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeOnce();
  } else {
    document.addEventListener('DOMContentLoaded', initializeOnce, { once: true });
  }
})();
