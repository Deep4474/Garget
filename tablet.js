(() => {
  // Constants for tablet identification
  const TABLET_KEYWORDS = [
    // Generic tablet terms
    'tablet', 'tab', '2-in-1 tablet', 'android tablet', 'windows tablet',
    
    // Apple tablets
    'ipad', 'ipad pro', 'ipad air', 'ipad mini',
    
    // Samsung tablets
    'galaxy tab', 'samsung tab', 'tab s', 'tab a', 'tab e',
    
    // Other major brands
    'surface', 'surface pro', 'surface go',
    'xiaomi pad', 'mi pad', 'redmi pad',
    'huawei matepad', 'mediapad',
    'lenovo tab', 'yoga tab',
    'realme pad', 'oppo pad',
    'nokia t20', 'nokia t21'
  ];

  const formatPrice = (value) => {
    if (!value) return '₦0.00';
    return new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN' 
    }).format(value);
  };

  const isTabletProduct = (product) => {
    if (!product) return false;
    
    // Strictly exclude non-tablet items
    const excludeKeywords = [
      // Mobile phones
      'phone', 'smartphone', 'mobile phone', 'gsm',
      
      // Computers
      'laptop', 'notebook', 'desktop', 'computer', 'pc',
      
      // Accessories - General
      'accessories', 'charger', 'adapter', 'power bank',
      
      // Accessories - Protection
      'case', 'cover', 'screen protector', 'tempered glass', 'pouch', 'sleeve',
      
      // Accessories - Input
      'keyboard', 'stylus', 'pen', 'pencil', 'mouse', 'touchpad',
      
      // Accessories - Support
      'stand', 'mount', 'holder', 'dock', 'docking station',
      
      // Parts
      'replacement', 'spare', 'part', 'battery', 'screen', 'display'
    ];
    
    const searchText = [
      product.name || '',
      product.category || '',
      product.description || '',
      product.subcategory || '',
      product.product_type || '',
      (Array.isArray(product.tags) ? product.tags.join(' ') : product.tags || '')
    ].join(' ').toLowerCase().trim();
    
    // Special case 1: if category is explicitly "tablet", it's a tablet
    const category = (product.category || '').toLowerCase().trim();
    if (category === 'tablet' || category === 'tablets') {
      console.log('[tablet] Included by category:', product.name);
      return true;
    }

    // Special case 2: check product type
    const productType = (product.product_type || '').toLowerCase().trim();
    if (productType === 'tablet' || productType === 'tablets') {
      console.log('[tablet] Included by product type:', product.name);
      return true;
    }

    // Special case 3: check subcategory
    const subcategory = (product.subcategory || '').toLowerCase().trim();
    if (subcategory === 'tablet' || subcategory === 'tablets') {
      console.log('[tablet] Included by subcategory:', product.name);
      return true;
    }

    // Check for accessories and other non-tablet items
    if (excludeKeywords.some(keyword => searchText.includes(keyword))) {
      console.log('[tablet] Excluded product:', product.name, '- matched exclusion keyword');
      return false;
    }
    
    // Look for tablet keywords
    const isTablet = TABLET_KEYWORDS.some(keyword => searchText.includes(keyword.toLowerCase()));
    
    // Additional checks to ensure it's really a tablet
    if (isTablet) {
      // Check product name directly for stronger match
      const name = (product.name || '').toLowerCase().trim();
      const hasStrongMatch = TABLET_KEYWORDS.some(keyword => 
        name.includes(keyword.toLowerCase()) || 
        name.match(new RegExp(`\\b${keyword.toLowerCase()}\\b`))
      );
      
      if (hasStrongMatch) {
        console.log('[tablet] Found tablet product (strong match):', product.name);
        return true;
      }
      
      // Check if price suggests it's a tablet (avoid accessories)
      const price = Number(product.price || product.amount || 0);
      if (price > 50000) { // Tablets usually cost more than 50,000 NGN
        console.log('[tablet] Found tablet product (price validated):', product.name);
        return true;
      }
      
      // Special case 4: Check for specific model numbers
      const modelPattern = /(?:sm-[tp]\d{3}|a\d{4}|m\d{4}|ipad\d{1,2}|\bth\d{4}\b)/i;
      if (modelPattern.test(searchText)) {
        console.log('[tablet] Found tablet product (model number match):', product.name);
        return true;
      }
      
      console.log('[tablet] Possible tablet but needs verification:', product.name);
    }
    
    // If we got here and no strong match was found, it's probably not a tablet
    return false;
  };

  const render = (products) => {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    if (!Array.isArray(products) || products.length === 0) {
      grid.innerHTML = '<div class="ap-loading">No tablets found.</div>';
      return;
    }

    const seen = new Set();
    const uniqueProducts = [];
    for (const p of products) {
      const idKey = p.id || p.product_id || p.uuid || null;
      const nameKey = (p.name || p.title || '').trim().toLowerCase();
      const key = idKey ? `${String(idKey)}|${p.__source || ''}` : `${nameKey}|${p.__source || ''}`;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueProducts.push(p);
    }

    grid.innerHTML = uniqueProducts.map(p => {
      const img = p.image_url || p.image || 'assets/images/tablet.png';
      const title = (p.name || p.title || p.product_name || 'Untitled').replace(/</g,'&lt;');
      const price = formatPrice(p.price || p.amount || 0);
      const slug = p.slug || p.id || '';
      const pid = p.id || p.product_id || slug || '';
      const _srcLabel = p.source || p.__source || p.__table || '';
      const sourceBadge = (_srcLabel && _srcLabel !== 'product5') ? `<div class="source-badge">${_srcLabel}</div>` : '';
      const isProduct5 = (p.source === 'product5' || p.__source === 'product5' || p.__table === 'product5');
      const productHref = isProduct5 
        ? `new-product.html${img ? `?image_url=${encodeURIComponent(img)}&name=${encodeURIComponent(p.name || '')}` : ''}`
        : `product.html${slug ? `?id=${encodeURIComponent(slug)}` : ''}`;

      return `
        <article class="product-card" data-product-id="${pid}" data-slug="${slug}" data-href="${productHref}">
          <div class="product-overlay">
            <button class="icon-btn heart" data-action="wishlist" title="Add to wishlist">❤</button>
            <button class="icon-btn compare" data-action="compare" title="Compare">⇄</button>
          </div>
          <div class="product-thumb-wrap">
            <img class="product-img" src="${img}" alt="${title}" onerror="this.onerror=null;this.src='assets/images/tablet.png'" />
          </div>
          <h3 class="product-name product-title">${title}</h3>
          <div class="price product-price">${price}</div>
          ${sourceBadge}
          ${isProduct5 
            ? '<div class="product-card-actions"></div>'
            : '<div class="product-addbar" data-action="addbar"><span class="add-text">Add to cart</span></div>'
          }
        </article>
      `;
    }).join('\n');

    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.icon-btn') || e.target.closest('.product-addbar')) return;
        const href = card.getAttribute('data-href');
        if (href) {
          window.location.href = href;
        }
      });
    });
  };

  const loadTablets = async () => {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-spinner">Loading tablets...</div>';

    // Prefer the dedicated Supabase project's REST endpoint first
    const TABLET_SUPABASE_URL = 'https://ahzfkfxqtdtkrwlxvimp.supabase.co';
    const TABLET_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoemZrZnhxdGR0a3J3bHh2aW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcyMDksImV4cCI6MjA3NzM5MzIwOX0.us--sBWAKTPJrd4gPKMPLBgtkJVhAcrUEQoD9YTnJww';
    const TABLET_REST_BASE = String(TABLET_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1';
    try {
      if (TABLET_REST_BASE && TABLET_SUPABASE_ANON_KEY) {
        const url = `${TABLET_REST_BASE}/products?select=*&order=created_at.desc&limit=1000`;
        const res = await fetch(url, { headers: { 'apikey': TABLET_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + TABLET_SUPABASE_ANON_KEY, 'Accept': 'application/json' } });
        if (res && res.ok) {
          try {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length) {
              const tabletProducts = rows.filter(isTabletProduct).map(p => ({ ...p, __source: 'products', __table: 'products' }));
              console.log('[tablet] REST: found', tabletProducts.length, 'products');
              render(tabletProducts);
              return;
            }
          } catch (e) { /* parse error, fall back to SDK */ }
        }
      }
    } catch (e) {
      console.warn('[tablet] REST fetch failed, falling back to SDK:', e && e.message ? e.message : e);
    }

    if (typeof window.supabaseClient === 'undefined' || !window.supabaseClient) {
      if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        try {
          window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        } catch(e) {
          console.error('Failed to initialize Supabase client:', e);
          grid.innerHTML = '<div class="error-message">Failed to load products</div>';
          return;
        }
      }
    }

    let products = [];

    try {
      if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
        const candidateFields = ['category', 'name', 'description', 'subcategory', 'type', 'tags'];
        const orConditions = [];
        
        for (const field of candidateFields) {
          for (const keyword of TABLET_KEYWORDS) {
            orConditions.push(`${field}.ilike.%${keyword}%`);
          }
        }
        
        const res = await window.supabaseClient
          .from('products')
          .select('*')
          .or(orConditions.join(','))
          .limit(1000);
          
        if (res && !res.error && Array.isArray(res.data)) {
          const tabletProducts = res.data.filter(isTabletProduct);
          products = tabletProducts.map(p => ({ ...p, __source: 'products', __table: 'products' }));
        }
      }
    } catch (e) {
      console.warn('tablet.js supabase load failed:', e);
      products = [
        { id: 't1', name: 'Mock Tablet A', price: 120000, image_url: 'assets/images/tablet.png' },
        { id: 't2', name: 'Mock Tablet B', price: 180000, image_url: 'assets/images/tablet2.png' }
      ];
    }

    console.log('[tablet] Found tablet products:', products.length);
    products.forEach(p => console.log('[tablet] Product:', p.name, 'Category:', p.category));
    
    render(products);
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => loadTablets().catch(console.error), 8);
  } else {
    document.addEventListener('DOMContentLoaded', () => loadTablets().catch(console.error));
  }
})();