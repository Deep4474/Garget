/* view-all.js
   Fetch products from Supabase and render them in a grid.
*/


(function(){
  'use strict';

  async function fetchProducts(category = 'all') {
    let query = `${API_URL}/rest/v1/products?select=*`;
    if (category !== 'all') {
      // Use ilike for case-insensitive matching
      query += `&category=ilike.${encodeURIComponent('%' + category + '%')}`;
    }
    
    const response = await fetch(query, {
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
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

  // Add to cart utility (stores minimal cart in localStorage and updates badge)
  function addToCart(prod){
    if (!prod || !prod.id) return;
    const key = 'lmg_cart_v1';
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = stored.findIndex(x => String(x.id) === String(prod.id));
    if (idx > -1) {
      stored[idx].qty = (Number(stored[idx].qty) || 1) + 1;
    } else {
      const item = {
        id: prod.id,
        name: prod.name || prod.title || '',
        price: prod.price || 0,
        image_url: prod.image_url || (prod.image_urls && prod.image_urls[0]) || null,
        qty: 1
      };
      stored.push(item);
    }
    localStorage.setItem(key, JSON.stringify(stored));
    try { window.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: stored } })); } catch (e) {}
    // update visible badge if present
    const badge = document.querySelector('.cart-badge') || document.getElementById('cartBadge');
    if (badge) {
      const total = stored.reduce((s, i) => s + (Number(i.qty) || 0), 0);
      badge.textContent = total;
    }
    return stored;
  }
  // expose globally for other scripts to use if needed, but don't override an existing implementation
  if (!window.addToCart) window.addToCart = addToCart;

  function sortProducts(products, sortBy) {
    const sorted = [...products];
    switch (sortBy) {
      case 'price-asc':
        sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case 'price-desc':
        sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
    }
    return sorted;
  }

  function renderProducts(container, items){
    container.innerHTML = '';
    if (!items || items.length === 0){
      container.innerHTML = `
        <div class="ap-empty">
          <div class="empty-icon">📦</div>
          <h3>No Products Found</h3>
          <p>There are no products available in this category yet.</p>
        </div>`;
      return;
    }

    // Create grid container
    const grid = document.createElement('div');
    grid.className = 'products-grid ' + currentCategory;

    for (const p of items){
      const imgUrl = p.image_url || (p.image_urls && p.image_urls[0]) || 'assets/images/placeholder.jpg';
      const titleText = p.name || 'Untitled Product';
      const priceText = formatPrice(p.price);
      const categoryText = p.category || '';

      const cardHtml = `
        <div class="product-card">
          <a class="product-link" href="product.html?id=${p.id}" style="display:block;">
            <img 
              src="${escapeHtml(imgUrl)}" 
              alt="${escapeHtml(titleText)}"
              class="product-image"
              loading="lazy"
            >
          </a>
          <div class="product-overlay">
            <!-- overlay icons (heart/compare) could go here; add-to-cart moved to bottom bar -->
          </div>
          <div class="product-info">
            <h3 class="product-name">${escapeHtml(titleText)}</h3>
            <div class="product-price">${escapeHtml(priceText)}</div>
            ${categoryText ? `<div class="product-category">${escapeHtml(categoryText)}</div>` : ''}
            ${p.description ? `<p class="product-description">${escapeHtml(p.description)}</p>` : ''}
          </div>
          <div class="product-addbar" data-action="addbar">
            <button type="button" class="add-to-cart-btn" data-product-id="${p.id}" aria-label="Add to cart">
              <span class="add-icon" style="display:inline-block;vertical-align:middle;width:18px;height:18px;margin-right:8px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <circle cx="9" cy="21" r="1" fill="#fff"/>
                  <circle cx="20" cy="21" r="1" fill="#fff"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" stroke="#fff" stroke-width="2" fill="none"/>
                </svg>
              </span>
              <span class="add-text">Add to cart</span>
            </button>
          </div>
        </div>
      `;
      grid.insertAdjacentHTML('beforeend', cardHtml);
    }

    // Attach Add to Cart handlers (stop propagation so clicking the button doesn't navigate)
    grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.productId;
        const prod = items.find(x => String(x.id) === String(id));
        try {
          // prefer local addToCart implementation
          if (typeof addToCart === 'function') {
            addToCart(prod);
          } else if (window.addToCart && typeof window.addToCart === 'function') {
            window.addToCart(prod);
          }
        } catch (err) {
          console.error('addToCart error', err);
        }
      });
    });

    // Make the whole product card navigate to product page when clicked (except add-to-cart)
    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // If click originated from an interactive element that stopped propagation, this won't run.
        const link = card.querySelector('.product-link');
        if (link && link.href) {
          window.location.href = link.href;
        }
      });
    });

    container.appendChild(grid);
  }

  let currentCategory = 'all';

  function updatePageTitle(category) {
    const titles = {
      'all': 'All Products',
      'phones': 'Phones',
      'laptops': 'Laptops',
      'accessories': 'Accessories',
      'tvs': 'TVs'
    };
    document.title = `${titles[category] || 'Products'} - Lamar Phone & Gadget`;
    const h1 = document.querySelector('.section-header h1');
    if (h1) {
      h1.textContent = titles[category] || 'Products';
    }
  }

  async function loadAll(category = 'all'){
    const root = document.getElementById('allProductsRoot');
    const container = document.getElementById('allProductsContainer');
    if (!root || !container) {
      console.error('Required DOM elements not found');
      return;
    }

    container.innerHTML = '<div class="ap-loading">Loading products...</div>';
    currentCategory = category;
    updatePageTitle(category);

    try {
      // Update active tab
      document.querySelectorAll('.category-tab').forEach(tab => {
        if (tab.dataset.category === category) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // Fetch products for the selected category
      const products = await fetchProducts(category);

      if (!products || products.length === 0) {
        container.innerHTML = '<div class="ap-empty">No products found</div>';
        return;
      }

      // Sort products based on current selection
      const sortSelect = document.getElementById('sortSelect');
      if (sortSelect) {
        const sorted = sortProducts(products, sortSelect.value);
        renderProducts(container, sorted);

        // Setup sort change handler
        sortSelect.addEventListener('change', () => {
          const resorted = sortProducts(products, sortSelect.value);
          renderProducts(container, resorted);
        });
      } else {
        // No sort select, just render in default order
        renderProducts(container, products);
      }

    } catch (err) {
      console.error('Error loading products:', err);
      container.innerHTML = '<div class="ap-error">Failed to load products: ' + escapeHtml(err.message) + '</div>';
    }
  }

  // Handle floating chevron scroll-to-top
  function initFloatingChevron() {
    const chevron = document.getElementById('floatingChevron');
    if (chevron) {
      chevron.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  }

  // Initialize when the page loads
  document.addEventListener('DOMContentLoaded', () => {
    // Setup category tab listeners
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const category = tab.dataset.category;
        loadAll(category);
      });
    });

    // Initial load
    loadAll();
    initFloatingChevron();
  });

})();
