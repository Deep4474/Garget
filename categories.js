(async function(){
  // Prevent multiple initializations
  if (window.categoriesInitialized) {
    console.debug('[categories] Already initialized, skipping duplicate execution');
    return;
  }
  window.categoriesInitialized = true;
  // fixed set of categories (no 'All' — we show all products by default)
  // exclude Phones and Laptops from the default UI per request
  const fixedCategories = ['Tablets', 'Accessories'];
  // common subcategory mapping to display under each category card
  const categorySubMap = {
    Phones: ['Feature Phones', 'iPhones', 'Smartphone', 'Tablets'],
    Computing: ['Desktop', 'Laptops'],
    Accessories: ['Wi-Fi & Networking', 'Power Banks & Chargers', 'Audios', 'Screen Guards', 'Chargers', 'Batteries', 'Mouse', 'Keyboard']
  };

  // Ensure a Supabase client exists (create from global `supabase` SDK if needed)
  if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      try {
        window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        console.debug('[categories] created window.supabaseClient from SUPABASE_* globals');
      } catch (e) {
        console.warn('[categories] failed to create supabase client:', e && e.message ? e.message : e);
      }
    }
  }

  // Debug toggle: set to `true` to enable the on-page debug panel
  const ENABLE_CATEGORIES_DEBUG = false;

  // Categories we explicitly want to hide from the UI (common bad/duplicate names)
  // also blacklist Phones/Laptops so they don't appear even if discovered in DB
  const CATEGORY_BLACKLIST = new Set(['Wearables','Wearable','accessory','Phones','Phone','Laptops','Laptop']);

  // REST fallback helper: fetch all rows from a Supabase table via REST API
  // Simple retrying fetch helper used by REST fallback
  async function retryFetch(url, options, attempts = 3, backoff = 800) {
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res;
      } catch (err) {
        // if last attempt, rethrow
        if (i === attempts - 1) throw err;
        // wait with exponential backoff
        await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
      }
    }
  }

  // REST fallback helper: fetch all rows from a Supabase table via REST API
  async function restFetchAll(tableName) {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return [];
    try {
      const base = String(window.SUPABASE_URL).replace(/\/$/, '');
      const url = `${base}/rest/v1/${tableName}?select=*`;
      const res = await retryFetch(url, {
        method: 'GET',
        headers: {
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
          'Accept': 'application/json'
        }
      }, 3, 700);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.debug('[categories] REST fetch threw for', tableName, e && e.message ? e.message : e);
      return [];
    }
  }
  

  // Show a small network error panel with retry button (global for categories)
  function showNetworkError(message, retryCallback) {
    let p = document.getElementById('categoriesNetworkError');
    if (!p) {
      p = document.createElement('div');
      p.id = 'categoriesNetworkError';
      p.style.position = 'fixed';
      p.style.left = '12px';
      p.style.top = '12px';
      p.style.background = 'rgba(255,230,230,0.98)';
      p.style.color = '#800';
      p.style.padding = '10px';
      p.style.border = '1px solid #f3a';
      p.style.borderRadius = '6px';
      p.style.zIndex = 10000;
      p.style.maxWidth = '420px';
      document.body.appendChild(p);
    }
    p.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Network error</div><div style="font-size:13px;margin-bottom:8px">${String(message)}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Retry';
    btn.style.padding = '6px 10px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', function(){
      p.remove();
      try { retryCallback && retryCallback(); } catch(e){}
    });
    p.appendChild(btn);
  }

  // render the categories as cards (thumbnail + title + subcategory list)
  function renderCategoryList(categories) {
    const el = document.getElementById('categoriesList');
    if (!el) return;

    // small helper to pick a thumbnail per category (fallback image path)
    function thumbForCategory(name) {
      const n = String(name).toLowerCase();
      if (n.includes('phone')) return 'assets/images/phone-thumb.png';
      if (n.includes('tablet')) return 'assets/images/tablet-thumb.png';
      if (n.includes('laptop') || n.includes('comput')) return 'assets/images/computing.png';
      if (n.includes('access')) return 'assets/images/appliances.png';
      return 'assets/images/promo-banner.png';
    }

    el.innerHTML = categories.map((c, i) => {
      const thumb = thumbForCategory(c);
      const subs = categorySubMap[c] || [];
      return `
        <div class="category-card" data-cat="${c}" data-index="${i}" role="button" tabindex="0" aria-pressed="false">
          <div class="category-thumb">
            <img class="category-thumb-img" src="${thumb}" data-fallback="${thumb}" alt="${c}" onerror="this.onerror=null;this.src='assets/images/promo-banner.png'" />
          </div>
          <div class="category-meta">
            <div class="category-title">${c}</div>
            ${subs.length ? `<div class="category-sublist">${subs.map(s=>`<div>${s}</div>`).join('')}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

  // attach click handlers and keyboard activation with active toggling
    const nodes = el.querySelectorAll('.category-card');
    nodes.forEach(node => {
      const activate = async function(){
        const cat = node.dataset.cat || '';
        const low = String(cat).toLowerCase();
        // if user clicked Phones, navigate to dedicated phone page
        if (low.includes('phone')) {
          window.location.href = 'phone.html';
          return;
        }
        // if user clicked Laptops, navigate to dedicated laptop page
        if (low.includes('laptop')) {
          window.location.href = 'laptop.html';
          return;
        }
        // if user clicked Tablets, navigate to dedicated tablet page
        if (low.includes('tablet')) {
          window.location.href = 'tablet.html';
          return;
        }
          // if user clicked Accessories, navigate to dedicated accessories page
          if (low.includes('access')) {
            window.location.href = 'accessories.html';
            return;
          }
        setActive(node);
        await loadProductsForCategory(cat);
      };
      node.addEventListener('click', activate);
      node.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });

    // asynchronously populate thumbnails from Supabase if available
    (async function populateThumbnails(){
      if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') return;
      const client = window.supabaseClient;
  const tables = ['products','product2'];
      // helper to extract image url from a record
      function pickImage(rec){
        if (!rec) return null;
        return rec.image_url || rec.image || (Array.isArray(rec.image_urls) && rec.image_urls[0]) || (Array.isArray(rec.images) && rec.images[0]) || rec.photo || null;
      }

      for (const node of nodes) {
        try {
          const cat = node.dataset.cat || '';
          if (!cat) continue;
          let found = null;
          for (const t of tables) {
            try {
              // Probe a sample row to learn which candidate fields exist and are text/array
              let presentFields = [];
              try {
                const sample = await client.from(t).select('*').limit(1);
                if (sample && !sample.error && Array.isArray(sample.data) && sample.data.length) {
                  const row = sample.data[0];
                  const candidate = ['category','categories','category_name','cat','type','tags'];
                  presentFields = candidate.filter(f => Object.prototype.hasOwnProperty.call(row, f) && (typeof row[f] === 'string' || Array.isArray(row[f])));
                }
              } catch (e) {
                // probing failed for this table; skip to next table
                presentFields = [];
              }

              // If we found candidate textual/category fields, query them server-side only
              if (presentFields.length) {
                for (const f of presentFields) {
                  try {
                    // Use select('*') to avoid requesting non-existent image columns which can cause 400 errors
                    const res = await client.from(t).select('*').ilike(f, `%${cat}%`).limit(1);
                    if (res && !res.error && Array.isArray(res.data) && res.data.length) { found = res.data[0]; break; }
                  } catch (e) {
                    // ignore per-field errors and continue
                  }
                }
              }

              if (found) break;
            } catch(e) {
              // ignore table-level errors and continue to next table
            }
          }
          if (found) {
            const img = node.querySelector('img.category-thumb-img');
            const src = pickImage(found) || null;
            if (src && img) {
              img.src = src;
              img.onerror = function(){ this.onerror=null; this.src = this.getAttribute('data-fallback') || 'assets/images/promo-banner.png'; };
            }
          }
        } catch(e) { /* non-blocking */ }
      }
    })();
  }

  function setActive(node) {
    const parent = node.parentElement;
    if (!parent) return;
    parent.querySelectorAll('.category-card, .category-item').forEach(n => { n.classList.remove('active'); n.setAttribute('aria-pressed','false'); });
    node.classList.add('active');
    node.setAttribute('aria-pressed','true');
  }

  async function loadProductsForCategory(cat) {
    if (typeof window.supabaseClient === 'undefined') {
      console.warn('Supabase client not found; cannot load products for', cat);
      const grid = document.getElementById('productsGrid');
      if (grid) grid.innerHTML = '<div>Supabase not configured.</div>';
      return;
    }

    const client = window.supabaseClient;

    // show loading placeholder immediately
    const gridEl = document.getElementById('productsGrid');
    if (gridEl) gridEl.innerHTML = '<div class="center-padding">Loading products...</div>';

    // Debug panel helper (on-page) so results can be inspected without console
    function ensureDebugPanel() {
      if (!ENABLE_CATEGORIES_DEBUG) return null;
      let panel = document.getElementById('categoriesDebugPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'categoriesDebugPanel';
        panel.style.position = 'fixed';
        panel.style.right = '12px';
        panel.style.bottom = '12px';
        panel.style.maxWidth = '360px';
        panel.style.maxHeight = '40vh';
        panel.style.overflow = 'auto';
        panel.style.background = 'rgba(0,0,0,0.75)';
        panel.style.color = 'white';
        panel.style.fontSize = '12px';
        panel.style.padding = '8px';
        panel.style.zIndex = 9999;
        panel.style.borderRadius = '6px';
        panel.innerHTML = '<strong>Categories debug</strong><div id="categoriesDebugContent"></div>';
        document.body.appendChild(panel);
      }
      return document.getElementById('categoriesDebugContent');
    }
    function debug(msg, obj) {
      if (!ENABLE_CATEGORIES_DEBUG) return;
      try { console.debug('[categories] ', msg, obj); } catch(e){}
      const c = ensureDebugPanel();
      if (c) {
        const el = document.createElement('div');
        el.style.marginBottom = '6px';
        el.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg);
        if (obj) {
          try { el.textContent += ' ' + (typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch(e){}
        }
        c.insertBefore(el, c.firstChild);
      }
    }

    // remove any previously created debug panel when debug is disabled
    if (!ENABLE_CATEGORIES_DEBUG) {
      const old = document.getElementById('categoriesDebugPanel');
      if (old && old.parentElement) old.parentElement.removeChild(old);
      const oldError = document.getElementById('categoriesNetworkError');
      if (oldError && oldError.parentElement) oldError.parentElement.removeChild(oldError);
    }

    // Per-table status area (visible on page) for quick remote verification
    function ensureTableStatus() {
      let s = document.getElementById('categoriesTableStatus');
      if (!s) {
        s = document.createElement('div');
        s.id = 'categoriesTableStatus';
        s.style.position = 'fixed';
        s.style.left = '12px';
        s.style.bottom = '12px';
        s.style.background = 'rgba(255,255,255,0.95)';
        s.style.color = '#111';
        s.style.fontSize = '13px';
        s.style.padding = '8px';
        s.style.zIndex = 9999;
        s.style.border = '1px solid #ddd';
        s.style.borderRadius = '6px';
        s.innerHTML = '<strong>Tables status</strong><div id="categoriesTableStatusContent"></div>';
        document.body.appendChild(s);
      }
      return document.getElementById('categoriesTableStatusContent');
    }

    function setTableStatus(tableName, method, count, sample) {
      const c = ensureTableStatus();
      if (!c) return;
      const el = document.createElement('div');
      el.style.marginBottom = '6px';
      el.innerHTML = `<strong>${tableName}</strong>: ${method} — ${count} rows` + (sample ? `<div style="font-size:11px;color:#444">${JSON.stringify(sample)}</div>` : '');
      c.insertBefore(el, c.firstChild);
    }

    // Helper: normalize product rows coming from different tables so renderProducts
    // can rely on common fields (id, name, price, image_url, description, stock, category, slug)
    function normalizeProduct(row) {
      if (!row || typeof row !== 'object') return null;
      const p = {};
      // id candidates
      p.id = row.id || row.product_id || row.uuid || row._id || null;
      // name/title candidates
      p.name = row.name || row.title || row.product_name || row.product || '';
      // price candidates (ensure number)
      const priceVal = row.price || row.amount || row.product_price || row.cost || row.unit_price;
      p.price = priceVal !== undefined && priceVal !== null && priceVal !== '' ? Number(priceVal) : (row.price ? Number(row.price) : 0);
      // image candidates
      p.image_url = row.image_url || row.image || (Array.isArray(row.image_urls) && row.image_urls[0]) || (Array.isArray(row.images) && row.images[0]) || row.photo || '';
      // description/stock/category/slug
      p.description = row.description || row.desc || row.details || '';
      p.stock = row.stock !== undefined ? row.stock : (row.qty !== undefined ? row.qty : null);
      p.category = row.category || row.categories || row.category_name || row.cat || '';
      p.slug = row.slug || row.handle || '';
      // keep original row for any extra fields
      p._raw = row;
      return p;
    }

    // Helper: try several possible category column names for a table and normalize results
    async function fetchFromTableByCategory(tableName) {
  const candidateFields = ['category', 'categories', 'category_name', 'cat', 'type', 'tags', 'category_id', 'collection', 'collections'];
      // If a Supabase JS client is available, try server-side ilike queries first
      if (client && typeof client.from === 'function') {
        for (const field of candidateFields) {
          try {
            const res = await client.from(tableName).select('*').ilike(field, `%${cat}%`).limit(200);
            if (res) {
              if (res.error) {
                console.debug(`[categories] query ${tableName}.${field} returned error:`, res.error && res.error.message ? res.error.message : res.error);
                debug(`${tableName}.${field} -> SDK error: ${res.error && res.error.message ? res.error.message : JSON.stringify(res.error)}`);
              } else {
                const rows = Array.isArray(res.data) ? res.data : [];
                console.debug(`[categories] query ${tableName}.${field} matched ${rows.length} rows`, (rows && rows[0]) ? rows[0] : null);
                debug(`query ${tableName}.${field} matched ${rows.length} rows`);
                return rows.map(normalizeProduct).filter(Boolean);
              }
            }
            if (res && res.error && res.error.code === 'PGRST205') return [];
          } catch (e) {
            // ignore and try next field
          }
        }

        // fallback: fetch all rows via client and filter client-side
        try {
          const resAll = await client.from(tableName).select('*').limit(200);
          if (resAll && !resAll.error) {
            const rows = Array.isArray(resAll.data) ? resAll.data : [];
            console.debug(`[categories] fetched ${rows.length} rows from ${tableName} (client-side filter)` , (rows && rows[0]) ? rows[0] : null);
            debug(`fetched ${rows.length} rows from ${tableName} (client-side filter)`);
            const filtered = rows.filter(r => {
              if (!r) return false;
              for (const k in r) {
                const v = r[k];
                if (!v) continue;
                if (typeof v === 'string' && v.toLowerCase().includes(cat.toLowerCase())) return true;
                if (Array.isArray(v) && v.join(' ').toLowerCase().includes(cat.toLowerCase())) return true;
              }
              return false;
            });
            return filtered.map(normalizeProduct).filter(Boolean);
          }
        } catch (e) {
          // ignore and fall through to REST fallback
        }
      }

      // REST fallback: fetch all rows and filter client-side
      try {
        const rows = await restFetchAll(tableName);
        debug(`REST fetched ${rows.length} rows from ${tableName} for client-side filtering`);
        const filtered = rows.filter(r => {
          if (!r) return false;
          for (const k in r) {
            const v = r[k];
            if (!v) continue;
            if (typeof v === 'string' && v.toLowerCase().includes(cat.toLowerCase())) return true;
            if (Array.isArray(v) && v.join(' ').toLowerCase().includes(cat.toLowerCase())) return true;
          }
          return false;
        });
        return filtered.map(normalizeProduct).filter(Boolean);
      } catch (e) {
        // ignore
      }
      return [];
    }

  // Tables to query (include product2 as requested)
  const tables = ['products', 'product2'];
    const promises = tables.map(t => fetchFromTableByCategory(t));
    let results = [];
    try {
      const sets = await Promise.all(promises);
      results = [].concat(...sets).filter(Boolean);
    } catch (e) {
      console.error('Error fetching category products:', e);
      const grid = document.getElementById('productsGrid');
      if (grid) grid.innerHTML = '<div>Error loading products.</div>';
      // Show network error with a retry button that re-invokes the category loader
      try {
        showNetworkError(e && e.message ? e.message : String(e), function(){ loadProductsForCategory(cat).catch(()=>{}); });
      } catch (err) {}
      return;
    }

    // dedupe by id (or name fallback)
    const seen = new Set();
    const products = results.filter(item => {
      if (!item) return false;
      let key = null;
      if (item.id) key = String(item.id);
      else if (item.name) key = String(item.name).trim().toLowerCase();
      else key = JSON.stringify(item._raw || item);
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // expose globally for other scripts
    window.products = products;

    // Use existing renderProducts if available
    if (typeof window.renderProducts === 'function') {
      window.renderProducts(products);
    } else {
      const grid = document.getElementById('productsGrid');
      if (grid) grid.innerHTML = '<div>Products loaded but renderProducts not available.</div>';
    }
  }
  // Adds an "All" loader that fetches product2/product3 without category filter
  async function loadAllProducts() {
    if (typeof window.supabaseClient === 'undefined') {
      console.warn('Supabase client not found; using mock fallback data for categories');
      // Provide a small mock dataset so the UI can be previewed without Supabase
      const mock = [
        { id: 'm1', name: 'Mock Phone A', price: 45000, image_url: 'assets/images/smartphone.png', category: 'Phones' },
        { id: 'm2', name: 'Mock Laptop B', price: 250000, image_url: 'assets/images/laptop.png', category: 'Laptops' },
        { id: 'm3', name: 'Mock Tablet C', price: 120000, image_url: 'assets/images/tablet.png', category: 'Tablets' },
        { id: 'm4', name: 'Mock Headphones D', price: 8000, image_url: 'assets/images/headphones.png', category: 'Accessories' }
      ];
      window.products = mock;
      if (typeof window.renderProducts === 'function') {
        window.renderProducts(mock);
      } else {
        const grid = document.getElementById('productsGrid');
        if (grid) grid.innerHTML = '<div>Mock products loaded but renderProducts not available.</div>';
      }
      return;
    }
    const client = window.supabaseClient;
  // Query both products and product2
  const tables = ['products', 'product2'];
    const fetchAllFrom = async (t) => {
      try {
        if (client && typeof client.from === 'function') {
          const r = await client.from(t).select('*').limit(500);
          if (r && !r.error) return Array.isArray(r.data) ? r.data.map(normalizeProduct).filter(Boolean) : [];
        } else {
          const rows = await restFetchAll(t);
          return Array.isArray(rows) ? rows.map(normalizeProduct).filter(Boolean) : [];
        }
      } catch (e) { /* ignore */ }
      return [];
    };
    try {
      const sets = await Promise.all(tables.map(fetchAllFrom));
      const combined = [].concat(...sets).filter(Boolean);
      // dedupe by id or name
      const seen = new Set();
      const products = combined.filter(item => {
        const key = item && (item.id ? String(item.id) : (item.name ? item.name : JSON.stringify(item._raw || item)));
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      window.categoryProducts = products; // Use a dedicated variable instead of generic 'products'
      if (typeof window.renderProducts === 'function') {
        const grid = document.getElementById('productsGrid');
        if (grid) {
          grid.innerHTML = ''; // Clear existing content first
          window.renderProducts(products);
        }
      } else {
        const grid = document.getElementById('productsGrid');
        if (grid) grid.innerHTML = '<div>Products loaded but renderProducts not available.</div>';
      }
    } catch (e) {
      console.error('Error loading all products:', e);
      const grid = document.getElementById('productsGrid');
      if (grid) grid.innerHTML = '<div>Error loading products.</div>';
      try {
        showNetworkError(e && e.message ? e.message : String(e), function(){ loadAllProducts().catch(()=>{}); });
      } catch (err) {}
    }
  }

  // Load categories from both `products` and `product2` tables (extract, split, dedupe)
  // Normalize 'Laptop' and 'Laptops' to 'Tablets' as requested
  async function initCategories() {
    // Clear any existing products
    const productsGrid = document.getElementById('productsGrid');
    if (productsGrid) {
      productsGrid.innerHTML = '';
    }
    
    const client = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
    if (!client || typeof client.from !== 'function') {
      renderCategoryList(fixedCategories);
      return;
    }
    try {
  const tablesToScan = ['products', 'product2'];
      const set = new Set();
      // helper to normalize category display names (Title Case) so 'Accessories' and 'accessory' are considered the same
      function normalizeDisplayName(s) {
        if (!s) return '';
        const parts = String(s).trim().split(/\s+/).filter(Boolean);
        return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
      for (const t of tablesToScan) {
        try {
          // select all columns to avoid 400 errors when specific columns are missing
          const res = await client.from(t).select('*').limit(2000);
          if (res && !res.error && Array.isArray(res.data)) {
            res.data.forEach(row => {
              if (!row) return;
              // category could be in several fields or even an array
              const candidates = [];
              if (row.category) candidates.push(row.category);
              if (row.categories) candidates.push(row.categories);
              if (row.category_name) candidates.push(row.category_name);
              if (row.cat) candidates.push(row.cat);
              // also handle arrays
              candidates.forEach(rawVal => {
                if (!rawVal) return;
                if (Array.isArray(rawVal)) {
                  rawVal.forEach(p => {
                    if (!p) return;
                    const lower = String(p).trim().toLowerCase();
                    if (lower === 'laptop' || lower === 'laptops') set.add('Laptops');
                    else if (lower === 'tablet' || lower === 'tablets') set.add('Tablets');
                    else if (lower === 'accessory' || lower === 'accessories') set.add('Accessories');
                    else set.add(normalizeDisplayName(p));
                  });
                } else {
                  // comma-separated or single string
                  const parts = String(rawVal).split(',').map(s => s.trim()).filter(Boolean);
                  parts.forEach(p => {
                    if (!p) return;
                    const lower = String(p).toLowerCase();
                    if (lower === 'laptop' || lower === 'laptops') set.add('Laptops');
                    else if (lower === 'tablet' || lower === 'tablets') set.add('Tablets');
                    else if (lower === 'accessory' || lower === 'accessories') set.add('Accessories');
                    else set.add(normalizeDisplayName(p));
                  });
                }
              });
            });
          }
        } catch (innerErr) {
          console.debug('[categories] error scanning', t, innerErr && innerErr.message ? innerErr.message : innerErr);
        }
      }
      const list = Array.from(set);
      if (list.length > 0) {
  // Order categories: always keep fixedCategories first, then the rest discovered from DB
  const ordered = [];
  fixedCategories.forEach(fc => { if (!ordered.includes(fc)) ordered.push(fc); });
      list.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
        // Filter any blacklisted names (remove duplicates or broken entries like 'Wearables')
        const filtered = ordered.filter(n => !CATEGORY_BLACKLIST.has(n));
        renderCategoryList(filtered);
        return;
      }
    } catch (e) {
      console.debug('[categories] error fetching categories', e && e.message ? e.message : e);
    }
    // fallback
    renderCategoryList(fixedCategories);
  }
  // Render the fixed categories immediately so the UI shows something
  try { renderCategoryList(fixedCategories); } catch(e) {}
  initCategories().catch(() => { renderCategoryList(fixedCategories); });
  // Run quick remote checks for each product table and show status
  async function runTableChecks() {
  const tablesToCheck = ['products', 'product2'];
    for (const t of tablesToCheck) {
      try {
        let rows = [];
        let method = 'SDK';
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
          try {
            const res = await window.supabaseClient.from(t).select('*').limit(5);
            if (res && !res.error) rows = Array.isArray(res.data) ? res.data : [];
            else if (res && res.error) {
              // fallback to REST
              method = 'REST';
              rows = await restFetchAll(t);
            }
          } catch (e) {
            method = 'REST';
            rows = await restFetchAll(t);
          }
        } else {
          method = 'REST';
          rows = await restFetchAll(t);
        }
        setTableStatus(t, method, Array.isArray(rows) ? rows.length : 0, (rows && rows[0]) ? rows[0] : null);
      } catch (e) {
        setTableStatus(t, 'ERROR', 0, { message: e && e.message ? e.message : String(e) });
      }
    }
  }
  // run checks immediately (non-blocking)
  runTableChecks().catch(()=>{});
  // No automatic product loading: products will appear only when a category card is clicked
})();