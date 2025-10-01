// Force two products per row in the grid
function enforceTwoPerRow() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  // Remove all whitespace between product cards to avoid inline-block issues
  grid.innerHTML = grid.innerHTML.replace(/>\s+</g, '><');
}
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(enforceTwoPerRow, 1000); // Wait for products to render
});
// Live Advert Product Rotator (Supabase version)
document.addEventListener('DOMContentLoaded', async function() {
  var nameElem = document.getElementById('liveAdvertProductName');
  var priceElem = document.getElementById('liveAdvertProductPrice');
  var imgElem = document.getElementById('liveAdvertProductImg');

  async function fetchProductsForAdvert() {
    // Adjust the select fields as per your Supabase 'products' table
    const { data, error } = await supabase.from('products').select('name, price, image_url');
    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data;
  }

  let products = await fetchProductsForAdvert();
  if (!products || products.length === 0) {
    // fallback if no products
    products = [
      { name: 'No products available', price: '', image_url: '' }
    ];
  }
  let idx = 0;
  function showProduct(i) {
    var p = products[i];
    if (nameElem && priceElem && imgElem) {
      nameElem.textContent = p.name || '';
      priceElem.textContent = p.price ? `₦${p.price}` : '';
      if (p.image_url) {
        imgElem.src = p.image_url;
        imgElem.style.display = 'inline-block';
        imgElem.alt = p.name;
      } else {
        imgElem.style.display = 'none';
      }
    }
  }
  showProduct(idx);
  setInterval(function() {
    idx = (idx + 1) % products.length;
    showProduct(idx);
  }, 3500);
});
// Fetch and render orders for the current user
async function fetchOrdersForUser(email) {
  // Adjust query if you want to filter by sender or other columns
  const { data, error } = await supabase.from('orders').select('*').eq('email', email);
  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
  return data;
}

function renderOrders(orders) {
  const ordersGrid = document.getElementById('ordersGrid');
  if (!ordersGrid) return;
  if (!orders || orders.length === 0) {
    ordersGrid.innerHTML = '<div style="padding:2em;text-align:center;">No orders found</div>';
    return;
  }
    // Show sender names as clickable items
    ordersGrid.innerHTML = `<h3>Order Senders</h3><ul style='list-style:none;padding:0;'>` +
      orders.map((order, idx) => `<li class='order-sender-item' data-order-idx='${idx}' style='cursor:pointer;'>${order.sender_name || 'N/A'}</li>`).join('') + '</ul>';
    ordersGrid.style.display = 'block';
    // Add click event to each sender item
    const senderItems = ordersGrid.querySelectorAll('.order-sender-item');
    senderItems.forEach(item => {
      item.addEventListener('click', function() {
        const idx = this.getAttribute('data-order-idx');
        showOrderModal(orders[idx]);
      });
    });
  }

  // Simple modal for order details
  function showOrderModal(order) {
    let modal = document.getElementById('orderDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'orderDetailModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class='modal-content'>
          <span class='close'>&times;</span>
          <h2>Order Details</h2>
          <div><strong>Sender:</strong> ${order.sender_name || 'N/A'}</div>
          <div><strong>Product:</strong> ${order.product_id}</div>
          <div><strong>Quantity:</strong> ${order.quantity}</div>
          <div><strong>Status:</strong> ${order.status}</div>
          <div><strong>Pick Option:</strong> ${order.pick_option}</div>
          <div><strong>Address:</strong> ${order.address}</div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.close').onclick = function() {
        modal.style.display = 'none';
      };
    } else {
      modal.querySelector('h2').textContent = 'Order Details';
      modal.querySelectorAll('div')[1].innerHTML = `<strong>Sender:</strong> ${order.sender_name || 'N/A'}`;
      modal.querySelectorAll('div')[2].innerHTML = `<strong>Product:</strong> ${order.product_id}`;
      modal.querySelectorAll('div')[3].innerHTML = `<strong>Quantity:</strong> ${order.quantity}`;
      modal.querySelectorAll('div')[4].innerHTML = `<strong>Status:</strong> ${order.status}`;
      modal.querySelectorAll('div')[5].innerHTML = `<strong>Pick Option:</strong> ${order.pick_option}`;
      modal.querySelectorAll('div')[6].innerHTML = `<strong>Address:</strong> ${order.address}`;
    }
    modal.style.display = 'block';
    // Close modal when clicking outside
    window.onclick = function(event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };
  }
// Make Orders menu item clickable to show user's orders
document.addEventListener('DOMContentLoaded', function() {
  const ordersMenuLink = document.querySelector('.menu-link[href="#orders"]');
  if (ordersMenuLink) {
    ordersMenuLink.addEventListener('click', async function(e) {
      e.preventDefault();
      // Get current user email (from localStorage or Supabase auth)
      let userEmail = localStorage.getItem('email');
      if (!userEmail && window.supabase && supabase.auth) {
        const { data: { user } } = await supabase.auth.getUser();
        userEmail = user ? user.email : null;
      }
      if (!userEmail) {
        alert('Please sign in to view your orders.');
        return;
      }
      // Fetch and render orders
      const orders = await fetchOrdersForUser(userEmail);
      renderOrders(orders);
      // Show orders grid
      const ordersGrid = document.getElementById('ordersGrid');
      if (ordersGrid) ordersGrid.style.display = 'block';
    });
  }
});
// Slide-out menu drawer logic
document.addEventListener('DOMContentLoaded', function() {
  const menuBtn = document.getElementById('menuBtn');
  const menuDrawer = document.getElementById('menuDrawer');
  const closeMenuDrawer = document.getElementById('closeMenuDrawer');
  // Remove Account menu if registered and show user info
  const menuDrawerContent = document.querySelector('.menu-drawer-content');
  function removeAccountLinks() {
    // Remove all elements with id 'accountMenuLink' and class 'account-menu'
    document.querySelectorAll('#accountMenuLink, .account-menu').forEach(function(el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }
  function showUserInfo(email) {
    if (!menuDrawerContent) return;
    let userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;">
        <img src="assets/images/default-profile.png" alt="Profile" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
        <div>
          <div style="font-weight:bold;">Registered User</div>
          <div style="font-size:12px;color:#555;">${email}</div>
        </div>
      </div>
    `;
    // Remove any previous user info
    let oldUserInfo = menuDrawerContent.querySelector('.user-info');
    if (oldUserInfo) oldUserInfo.remove();
    menuDrawerContent.insertBefore(userInfo, menuDrawerContent.firstChild);
  }

  if (localStorage.getItem('registeredEmail')) {
    removeAccountLinks();
    showUserInfo(localStorage.getItem('registeredEmail'));
  } else {
    // Attach mailto logic to all account links
    document.querySelectorAll('#accountMenuLink, .account-menu').forEach(function(accountLink) {
      accountLink.onclick = function(e) {
        e.preventDefault();
        // Direct user to their email client
        window.location.href = 'mailto:';
      };
    });
  }
  if (menuBtn && menuDrawer && closeMenuDrawer) {
    menuBtn.onclick = function() {
      menuDrawer.classList.add('open');
    };
    closeMenuDrawer.onclick = function() {
      menuDrawer.classList.remove('open');
    };
    window.addEventListener('click', function(e) {
      if (e.target === menuDrawer) {
        menuDrawer.classList.remove('open');
      }
    });
    // Category menu links: close menu and show category products
    document.querySelectorAll('.menu-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
          menuDrawer.classList.remove('open');
          const category = href.substring(1).toLowerCase();
          if (category) {
            if (category === 'chips' || category === 'ankara-style' || category === 'ankara') {
              filterProductsByCategory(category);
            }
            const productsSection = document.getElementById('productsGrid');
            if (productsSection) productsSection.scrollIntoView({behavior: 'smooth'});
          }
        }
      });
    });
    // Filtering function for chips and ankara style
    window.filterProductsByCategory = function(category) {
      // Fetch all products from Supabase and filter by category
      supabase.from('products').select('*').then(({ data, error }) => {
        if (error || !data) return;
        const filtered = data.filter(p => {
          const cat = (p.category || '').toLowerCase();
          return cat.includes(category.replace('-', ' '));
        });
        renderProducts(filtered);
      });
    };
  }
});
  // Fetch and render products from Supabase
  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data;
  }

  function renderProducts(products, categoryMap) {
      const grid = document.getElementById('productsGrid');
      if (!grid) return;
      if (!products || products.length === 0) {
        grid.innerHTML = '<div style="padding:2em;text-align:center;">No products available</div>';
        return;
      }
      grid.innerHTML = products.map(product => {
        const categoryName = categoryMap && product.category_id ? categoryMap[product.category_id] : (product.category || 'N/A');
        return `
          <div class="product-card">
            <img src="${product.image_url || 'https://placehold.co/180x180'}" alt="${product.name}" class="product-img">
            <div class="product-name">${product.name}</div>
            <div class="category">Category: ${categoryName}</div>
            <div class="description">${product.description || 'No description available.'}</div>
            <div class="stock">Stock: ${product.stock !== undefined ? product.stock : 'N/A'}</div>
            <div class="price">₦${Number(product.price).toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <button class="buy-btn" data-id="${product.id}" style="margin-top:10px;width:100%;">Buy Now</button>
          </div>
        `;
      }).join('');
      // Add event listeners for Buy Now buttons
      grid.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const id = this.getAttribute('data-id');
          const product = products.find(p => String(p.id) === String(id));
          openBuyModal(product);
        });
      });

  }

// Modal logic for Buy Now
function openBuyModal(product) {
  if (!product) return;
  const modal = document.getElementById('buyModal');
  if (!modal) return;
  modal.querySelector('.buy-product-name').textContent = product.name;
  modal.querySelector('.buy-product-price').textContent = '₦' + Number(product.price).toLocaleString(undefined, {minimumFractionDigits:2});
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  // Store product info for order
  modal.dataset.productId = product.id;
  modal.dataset.productName = product.name;
  modal.dataset.productPrice = product.price;
  // Reset form and status
  const orderForm = document.getElementById('orderForm');
  if (orderForm) orderForm.reset();
  const orderStatus = document.getElementById('orderStatus');
  if (orderStatus) orderStatus.textContent = '';
  // Autofill user name and email if logged in
  setTimeout(async function() {
    if (window.supabase && supabase.auth) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const emailInput = document.getElementById('orderEmail');
        if (emailInput) emailInput.value = user.email || '';
        const nameInput = document.getElementById('orderUserName');
        if (nameInput) nameInput.value = user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : (user.user_metadata && user.user_metadata.name ? user.user_metadata.name : '');
      }
    }
  }, 100);
}

document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('buyModal');
  if (modal) {
    modal.querySelector('.close').onclick = function() {
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
    };
    window.onclick = function(event) {
      if (event.target === modal) {
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
      }
    };
    // Handle order form submission
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
      orderForm.onsubmit = async function(e) {
        e.preventDefault();
        const quantity = Number(document.getElementById('orderQuantity').value);
        const product_price = Number(modal.dataset.productPrice);
        const order_total = product_price * quantity;
  const product_id = modal.dataset.productId;
  const product_name = modal.dataset.productName;
        const user_name = document.getElementById('orderUserName').value;
        const email = document.getElementById('orderEmail').value;
        const phone = document.getElementById('orderPhone').value;
        const address = document.getElementById('orderAddress').value;
        const status = 'pending'; // or get from a field if needed
        const pick_option = document.getElementById('orderPickOption').value;
        const orderStatus = document.getElementById('orderStatus');
        // Validate product_id is a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!product_id || !uuidRegex.test(product_id)) {
          orderStatus.textContent = 'Error: Product ID is missing or invalid.';
          orderStatus.style.color = 'red';
          return;
        }
        // Send order to Supabase
        const { data, error } = await supabase.from('orders').insert([
          {
            quantity,
            order_total,
            product_id,
            product_name,
            user_name,
            email,
            phone,
            address,
            status,
            pick_option
          }
        ]);
        if (error) {
          orderStatus.textContent = 'Order failed: ' + error.message;
          orderStatus.style.color = 'red';
        } else {
          orderStatus.textContent = 'Order placed successfully!';
          orderStatus.style.color = 'green';
          orderForm.reset();
        }
      };
    }
  }
  });
  // Additional code follows...
// Lamar Mobile JS (structure similar to desktop)
// Lamar Mobile JS (structure similar to desktop)
// Ensure Supabase CORS settings include: https://glittery-torrone-d1184e.netlify.app
// Add your product/category logic here as needed
// Supabase credentials must be provided securely via environment variables or backend API.
// Remove public key from frontend for security. See README for setup instructions.
let supabase = null;
if (window.SUPABASE_URL && window.SUPABASE_KEY) {
  supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
} else {
  console.warn('Supabase credentials are not set. Please provide them securely.');
}
// If deploying to Netlify, make sure CORS settings in Supabase dashboard include your Netlify URL
    // Add this function to update the account section
    function updateAccountSection() {
  const accountMenu = document.getElementById('accountMenuLink');
    const userName = localStorage.getItem('name');
    const userEmail = localStorage.getItem('email');
    const userPic = localStorage.getItem('profilePic');

    if (userName && userEmail) {
          // Remove the Account menu item completely
          if (accountMenu) accountMenu.parentNode.removeChild(accountMenu);

      // Show user info
      const userInfo = document.createElement('div');
      userInfo.className = 'user-info';
      userInfo.innerHTML =
        `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;">
          <img src="${userPic || 'assets/images/default-profile.png'}" alt="Profile" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
          <div>
            <div style="font-weight:bold;">${userName}</div>
            <div style="font-size:12px;color:#555;">${userEmail}</div>
          </div>
        </div>`;
      // Insert userInfo before the menu or in the sidebar
      const sidebar = document.querySelector('.sidebar'); // Adjust selector as needed
      if (sidebar) sidebar.insertBefore(userInfo, sidebar.firstChild);
    }
    }

    // Call this on page load
  window.addEventListener('DOMContentLoaded', updateAccountSection);

document.addEventListener('DOMContentLoaded', async function() {
  // Example: handle nav active state
  document.querySelectorAll('.mobile-nav .nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      document.querySelectorAll('.mobile-nav .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      e.preventDefault();
    });
  });

  // Fetch categories and products
  async function fetchCategories() {
    const { data, error } = await supabase.from('categories').select('*');
    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
    return data;
  }

  function renderCategories(categories) {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    if (!categories || categories.length === 0) {
      grid.innerHTML = '<div style="padding:2em;text-align:center;">No categories available</div>';
      return;
    }
    grid.innerHTML = categories.map(cat => {
      return `
        <div class="category-card" data-category-id="${cat.id}" data-category-name="${cat.name}">
          <div>${cat.name}</div>
        </div>
      `;
    }).join('');
  }

  // On DOMContentLoaded, fetch and render categories and products
  const categories = await fetchCategories();
  renderCategories(categories);
  const products = await fetchProducts();

  // Map category id to name for easy lookup
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.id] = cat.name;
  });

  // Render all products by default
  renderProducts(products, categoryMap);

  // Map menu link hrefs to category names
  // Use lowercase category names for matching
  const hrefToCategory = {
    '#phones': 'phones',
    '#tablets': 'tablet',
    '#laptops': 'laptops',
    '#wearables': 'wearables',
    '#accessories': 'accessories',
    '#appliances': 'appliances',
    '#electronics': 'electronics',
    '#supermarket': 'supermarket',
    '#health': 'health',
    '#home': 'home',
    '#power': 'power',
    '#computing': 'computing',
    '#womens-fashion': "women's fashion",
    '#mens-fashion': "men's fashion",
    '#baby': 'baby',
    '#gaming': 'gaming'
  };
  // Add click listeners to menu category links for filtering
  document.querySelectorAll('.menu-categories .menu-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      const categoryName = hrefToCategory[href];
      if (!categoryName) {
        renderProducts(products, categoryMap);
        return;
      }
  // Find category id by name (lowercase)
  const categoryId = Object.keys(categoryMap).find(id => categoryMap[id].toLowerCase() === categoryName);
  // Filter products by category id or lowercase name
  const filtered = products.filter(p => (categoryId && String(p.category_id) === String(categoryId)) || (p.category && p.category.toLowerCase() === categoryName));
  renderProducts(filtered, categoryMap);
    });
  });
});
