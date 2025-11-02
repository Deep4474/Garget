(async function() {
  // Prevent duplicate initialization
  if (window.accessoriesInitialized) return;
  window.accessoriesInitialized = true;

  // Accessory subcategories for filtering
  const accessoryTypes = {
    'Phone Accessories': [
      'Phone Cases & Covers',
      'Screen Protectors',
      'Phone Chargers',
      'Power Banks',
      'Phone Holders',
      'Selfie Sticks',
      'Phone Grips'
    ],
    'Audio Accessories': [
      'Wireless Earbuds',
      'Headphones',
      'Bluetooth Speakers',
      'Wired Earphones',
      'Microphones'
    ],
    'Computer Accessories': [
      'Keyboards',
      'Mouse',
      'Mousepads',
      'USB Drives',
      'External Hard Drives',
      'Laptop Bags',
      'Webcams',
      'Laptop Cooling Pads'
    ],
    'Networking': [
      'Wi-Fi Routers',
      'Network Switches',
      'Ethernet Cables',
      'Wi-Fi Adapters',
      'Network Cards',
      'Modems',
      'Wi-Fi Extenders'
    ],
    'Gaming Accessories': [
      'Game Controllers',
      'Gaming Headsets',
      'Gaming Mouse',
      'Gaming Keyboards'
    ]
  };

  // Keywords to identify accessories in product data
  const accessoryKeywords = {
    'Phone Accessories': [
      'phone case', 'phone cover', 'screen protector', 'tempered glass',
      'phone charger', 'car charger', 'wireless charger', 'power bank',
      'phone holder', 'phone stand', 'selfie stick', 'phone grip',
      'phone mount', 'phone accessories'
    ],
    'Audio Accessories': [
      'earbuds', 'airpods', 'headphones', 'headset', 'earphones',
      'bluetooth speaker', 'wireless speaker', 'microphone', 'mic'
    ],
    'Computer Accessories': [
      'keyboard', 'mouse', 'mousepad', 'usb drive', 'flash drive',
      'hard drive', 'ssd', 'laptop bag', 'laptop sleeve', 'webcam',
      'cooling pad', 'laptop stand', 'computer accessories'
    ],
    'Networking': [
      'wifi router', 'network switch', 'ethernet cable', 'lan cable',
      'wifi adapter', 'network card', 'modem', 'wifi extender',
      'network accessories', 'networking'
    ],
    'Gaming Accessories': [
      'game controller', 'gaming headset', 'gaming mouse', 'gaming keyboard',
      'gaming accessories', 'game accessories', 'gaming gear'
    ]
  };

  // Function to check if a product is an accessory and determine its type
  function isAccessory(product) {
    // First, explicitly exclude main product categories
    const excludeKeywords = [
      'laptop computer', 'notebook computer', 'desktop computer', 
      'smartphone device', 'mobile device', 'tablet device', 'television set',
      'smart tv device'
    ];
    
    const searchText = [
      product.name || '',
      product.category || '',
      product.description || '',
      product.subcategory || '',
      product.type || '',
      (product.tags && Array.isArray(product.tags) ? product.tags.join(' ') : product.tags || '')
    ].join(' ').toLowerCase();

    // Check category field first - if it explicitly says "accessories", it's an accessory
    if ((product.category || '').toLowerCase().includes('accessories')) {
      return true;
    }

    // Check exclusions first
    if (excludeKeywords.some(keyword => searchText.includes(keyword.toLowerCase()))) {
      return false;
    }

    // Check against our categorized keywords
    for (const [category, keywords] of Object.entries(accessoryKeywords)) {
      if (keywords.some(keyword => searchText.includes(keyword.toLowerCase()))) {
        // Add the detected category to the product
        product._accessory_category = category;
        return true;
      }
    }

    // Check price as a last resort - most accessories are under ₦100,000
    const price = Number(product.price || product.amount || 0);
    if (price > 0 && price < 100000) {
      // Check if it has accessory-like words
      const accessoryIndicators = ['kit', 'adapter', 'cable', 'cover', 'protection', 'add-on', 'attachment'];
      if (accessoryIndicators.some(word => searchText.includes(word))) {
        return true;
      }
    }

    return false;
  }

  // Function to format price in Naira
  function formatPrice(price) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(price || 0);
  }

  // Fetch accessories from Supabase
  async function fetchAccessories() {
  // Prefer the dedicated project REST endpoint before falling back to the global SDK client.
  const ACCESSORIES_SUPABASE_URL = 'https://ahzfkfxqtdtkrwlxvimp.supabase.co';
  const ACCESSORIES_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoemZrZnhxdGR0a3J3bHh2aW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcyMDksImV4cCI6MjA3NzM5MzIwOX0.us--sBWAKTPJrd4gPKMPLBgtkJVhAcrUEQoD9YTnJww';
  const ACCESSORIES_REST_BASE = String(ACCESSORIES_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1';
  const grid = document.getElementById('accessoriesGrid') || document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-spinner">Loading accessories...</div>';

  // Try REST fetch first (safe: fetch a bulk of rows and filter client-side)
  try {
    if (ACCESSORIES_REST_BASE && ACCESSORIES_SUPABASE_ANON_KEY) {
      const url = `${ACCESSORIES_REST_BASE}/products?select=*&order=created_at.desc&limit=1000`;
      const res = await fetch(url, { headers: { 'apikey': ACCESSORIES_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + ACCESSORIES_SUPABASE_ANON_KEY, 'Accept': 'application/json' } });
      if (res && res.ok) {
        try {
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            // Filter for actual accessories using existing logic
            const accessories = data.filter(isAccessory);
            const accessoriesFiltered = accessories.filter(p => (p._accessory_category || '').toLowerCase() !== 'computer accessories');
            // Render the results by category (reuse existing rendering structure)
            if (Object.keys(accessoriesFiltered || {}).length === 0) {
              grid.innerHTML = '<div class="no-results">No accessories found</div>';
            } else {
              const categorized = {};
              for (const product of accessoriesFiltered) {
                const category = product._accessory_category || 'Other Accessories';
                if (!categorized[category]) categorized[category] = [];
                categorized[category].push(product);
              }
              grid.innerHTML = Object.entries(categorized).map(([category, products]) => `
                <div class="category-section">
                  <h2 class="category-title">${category}</h2>
                  <div class="products-grid">
                    ${products.map(product => `
                      <div class="product-card" data-id="${product.id}">
                        <img src="${product.image_url || 'assets/images/default-accessory.png'}" 
                             alt="${product.name}" 
                             class="product-image"
                             onerror="this.src='assets/images/default-accessory.png'">
                        <div class="product-info">
                          <h3 class="product-name">${product.name}</h3>
                          <p class="product-price">${formatPrice(product.price)}</p>
                          <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('');

              // Wire events
              grid.querySelectorAll('.product-card').forEach(card => {
                const productId = card.dataset.id;
                const addToCartBtn = card.querySelector('.add-to-cart-btn');
                if (addToCartBtn) addToCartBtn.addEventListener('click', (e) => { e.stopPropagation(); console.log('Add to cart:', productId); });
                card.addEventListener('click', () => { window.location.href = `product.html?id=${productId}`; });
              });
            }

            return accessoriesFiltered;
          }
        } catch (e) {
          // JSON parse error or unexpected shape — fall through to SDK fallback
        }
      }
    }
  } catch (e) {
    // REST fetch failed — will fall back to SDK below
    console.warn('[accessories] REST fetch failed, falling back to SDK:', e && e.message ? e.message : e);
  }
  // Support both page variants: prefer 'accessoriesGrid' (accessories.html) but fall back to 'productsGrid'
  const grid = document.getElementById('accessoriesGrid') || document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading-spinner">Loading accessories...</div>';

    // Make sure we have a Supabase client
      if (!window.supabaseClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      try {
        window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      } catch (e) {
        console.error('Failed to initialize Supabase client:', e);
        grid.innerHTML = '<div class="error-message">Failed to load products</div>';
        return [];
      }
    }

    try {
      // Build the query conditions
      // NOTE: older/newer Supabase/PostgREST schemas may not include columns like
      // 'subcategory' or 'tags'. Constructing server-side OR filters that refer
      // to missing columns causes a 400 error (PostgREST 42703). To avoid that,
      // fetch a sample of rows server-side and perform keyword filtering client-side
      // (we already have robust client-side detection in `isAccessory`).
      if (window.supabaseClient) {
        console.debug('[accessories] fetching products (unfiltered) from supabase');
        const { data, error } = await window.supabaseClient
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error) {
          console.error('Error fetching accessories:', error);
          grid.innerHTML = '<div class="error-message">Failed to load accessories</div>';
          return [];
        }

        if (data && Array.isArray(data)) {
          // Debug: log fetch results count and sample
          console.debug('[accessories] supabase returned products:', data.length, 'sample:', data.slice(0,3));

          // Filter for actual accessories
          const accessories = data.filter(isAccessory);
          console.debug('[accessories] products after accessory filter:', accessories.length);

          // Exclude Computer Accessories explicitly as requested
          const accessoriesFiltered = accessories.filter(p => (p._accessory_category || '').toLowerCase() !== 'computer accessories');
          console.debug('[accessories] products after excluding Computer Accessories:', accessoriesFiltered.length);
          
          // Group by category (use filtered list that excludes Computer Accessories)
          const categorized = {};
          for (const product of accessoriesFiltered) {
            const category = product._accessory_category || 'Other Accessories';
            if (!categorized[category]) {
              categorized[category] = [];
            }
            categorized[category].push(product);
          }

          // Render the results by category
          if (Object.keys(categorized).length === 0) {
            grid.innerHTML = '<div class="no-results">No accessories found</div>';
          } else {
            grid.innerHTML = Object.entries(categorized).map(([category, products]) => `
              <div class="category-section">
                <h2 class="category-title">${category}</h2>
                <div class="products-grid">
                  ${products.map(product => `
                    <div class="product-card" data-id="${product.id}">
                      <img src="${product.image_url || 'assets/images/default-accessory.png'}" 
                           alt="${product.name}" 
                           class="product-image"
                           onerror="this.src='assets/images/default-accessory.png'">
                      <div class="product-info">
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-price">${formatPrice(product.price)}</p>
                        <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('');

            // Add event listeners
            grid.querySelectorAll('.product-card').forEach(card => {
              const productId = card.dataset.id;
              
              // Add to cart button click
              const addToCartBtn = card.querySelector('.add-to-cart-btn');
              if (addToCartBtn) {
                addToCartBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  // TODO: Implement add to cart functionality
                  console.log('Add to cart:', productId);
                });
              }

              // Card click for product details
              card.addEventListener('click', () => {
                window.location.href = `product.html?id=${productId}`;
              });
            });
          }

          return accessoriesFiltered;
        }
      }
    } catch (error) {
      console.error('Error fetching accessories:', error);
      grid.innerHTML = '<div class="error-message">Error loading accessories</div>';
    }
    
    return [];
  }

  // Initialize on page load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => fetchAccessories().catch(console.error), 8);
  } else {
    document.addEventListener('DOMContentLoaded', () => fetchAccessories().catch(console.error));
  }
})();