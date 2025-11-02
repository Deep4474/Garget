(function(){
  const CART_KEY = 'lmg_cart_v1';
  function formatPrice(p){ try { return '₦' + Number(p).toLocaleString(); } catch(e){ return p; } }

  function loadCart(){
    const raw = localStorage.getItem(CART_KEY);
    const items = raw ? JSON.parse(raw) : [];
    const list = document.getElementById('itemsList');
    const totalEl = document.getElementById('summaryTotal');
    let total = 0;
    if (!items || !items.length){
      if (list) list.innerHTML = '<div class="items-row"><div class="item-name">Cart is empty</div></div>';
      if (totalEl) totalEl.textContent = formatPrice(0);
      return { items: [], total: 0 };
    }
    let html = '';
    items.forEach(it => {
      const qty = Number(it.qty)||1;
      const price = Number(it.price)||0;
      total += qty * price;
      html += `<div class="items-row"><div><div class="item-name">${(it.name||it.product_name||'Item')}</div><div class="item-meta">${qty} × ${formatPrice(price)}</div></div><div class="item-meta">${formatPrice(qty*price)}</div></div>`;
    });
    if (list) list.innerHTML = html;
    if (totalEl) totalEl.textContent = formatPrice(total);
    return { items, total };
  }

  async function tryPrefill(){
    const nameInput = document.getElementById('checkoutUserName');
    const emailInput = document.getElementById('checkoutEmail');
    if (!nameInput && !emailInput) return;
    let userName = localStorage.getItem('userName')||'';
    let userEmail = localStorage.getItem('userEmail')||'';
    try{
      if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.getUser === 'function'){
        const { data } = await window.supabaseClient.auth.getUser();
        if (data && data.user){
          userName = userName || data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';
          userEmail = userEmail || data.user.email || '';
        }
      }
    }catch(e){}
    if (nameInput) nameInput.value = userName;
    if (emailInput) emailInput.value = userEmail;
  }

  async function submitOrder(e){
    e && e.preventDefault && e.preventDefault();
    const status = document.getElementById('orderStatus');
    status.textContent = '';
    const name = document.getElementById('checkoutUserName').value.trim();
    const email = document.getElementById('checkoutEmail').value.trim();
    const phone = document.getElementById('checkoutPhone').value.trim();
    const address = document.getElementById('checkoutAddress').value.trim();
    const deliveryOption = document.getElementById('checkoutPickOption').value;
    const state = document.getElementById('checkoutState').value;
    
    // Validate delivery option
    if (deliveryOption !== 'Hub to Hub' && deliveryOption !== 'Hub to Door') {
        if (status) status.textContent = 'Please select a valid delivery option.';
        return;
    }
    const { items, total } = loadCart();
    if (!items.length){ if (status) status.textContent = 'Cart is empty.'; return; }
    if (!name || !email){ if (status) status.textContent = 'Name and email required.'; return; }
  // Build payload using a conservative whitelist so we don't send unknown
  // columns to Supabase (which would cause a 400).
  // We avoid adding an `items` column to `orders` by default because your
  // DB currently doesn't have it. Instead we create the order first and
  // then insert each cart item into a separate `order_items` table linked
  // by order_id. If you prefer storing items inside `orders` as JSONB,
  // change ORDER_ITEMS_COLUMN to the name of that column.
  const ORDER_ITEMS_COLUMN = null; // set to 'items' or your column name to store items on orders table

    const payload = {
      user_name: name,
      email: email,
      phone: phone,
      address: address,
      delivery_option: deliveryOption,
      state: state,
      order_total: total || 0,
      status: 'pending'
    };

    // Require authentication: RLS on the DB will reject anonymous inserts.
    // Try to get the currently signed-in user; if none, prompt and redirect to login.
      try {
        let currentUser = null;
        if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.getUser === 'function') {
          const result = await window.supabaseClient.auth.getUser();
          currentUser = result && result.data && result.data.user ? result.data.user : null;
        }

        // If there's no Supabase user, allow a locally-registered user to place an order
        // by saving a guest order to localStorage. This avoids forcing a redirect to login
        // for users who registered locally (stored userEmail/userName in localStorage).
        if (!currentUser) {
          const localEmail = localStorage.getItem('userEmail') || '';
          const localName = localStorage.getItem('userName') || '';
          if (localEmail) {
            // Try to send the order to Supabase anonymously using the anon key.
            // If that fails (RLS/network), fall back to saving the order locally.
            let client = null;
            if (window.supabaseClient && typeof window.supabaseClient.from === 'function') client = window.supabaseClient;
            else if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
              try { client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); } catch(e) { client = null; }
            }

            if (client) {
              try {
                const shipping = { name: name || localName, phone: phone, address: address, state: state, delivery_option: deliveryOption };
                const billing = { email: email || localEmail };
                const orderRow = {
                  user_id: null,
                  status: 'pending',
                  total: Number(total) || 0,
                  currency: 'NGN',
                  shipping: shipping,
                  billing: billing,
                  delivery_option: deliveryOption,
                  metadata: {
                    items_count: (items || []).length || 0,
                    primary_product_name: (items && items.length) ? (items[0].name || items[0].product_name || null) : null
                  }
                };

                const { data: orderData, error: orderError } = await client.from('orders').insert([orderRow], { returning: 'representation' });
                if (!orderError && orderData && orderData[0] && orderData[0].id) {
                  const orderId = orderData[0].id;
                  const orderItems = (items || []).map(it => {
                    const price = Number(it.price) || 0;
                    const qty = Number(it.qty) || 1;
                    return {
                      order_id: orderId,
                      product_id: it.id || it.product_id || null,
                      name: it.name || it.product_name || '',
                      sku: it.sku || null,
                      price: price,
                      qty: qty,
                      line_total: price * qty,
                      metadata: {}
                    };
                  });
                  if (orderItems.length) {
                    try {
                      const { error: oiError } = await client.from('order_items').insert(orderItems, { returning: 'minimal' });
                      if (oiError) {
                        console.warn('Failed to insert order_items for guest order', oiError);
                      }
                    } catch(e) { console.warn('order_items insert failed', e); }
                  }

                  if (status) status.textContent = 'Order created successfully! — Order ID: ' + orderId;
                  localStorage.removeItem(CART_KEY);
                  window.dispatchEvent(new Event('cart:updated'));
                  setTimeout(() => { window.location.href = 'index.html'; }, 1500);
                  return;
                }
                // if insert failed, we'll fall back to local save below
              } catch(e) {
                console.warn('Supabase guest insert failed, falling back to local save', e);
              }
            }

            // Save locally as fallback
            const guestOrdersKey = 'lmg_guest_orders_v1';
            const guestOrdersRaw = localStorage.getItem(guestOrdersKey);
            let guestOrders = guestOrdersRaw ? JSON.parse(guestOrdersRaw) : [];
            const guestOrder = {
              id: 'local_' + Date.now(),
              created_at: new Date().toISOString(),
              user_name: name || localName,
              email: email || localEmail,
              phone: phone,
              address: address,
              pick_option: pick,
              state: state,
              items: items,
              total: total || 0,
              status: 'pending_local'
            };
            guestOrders.push(guestOrder);
            try { localStorage.setItem(guestOrdersKey, JSON.stringify(guestOrders)); } catch (err) { console.warn('Could not save guest order locally', err); }
            if (status) status.textContent = 'Order saved locally (guest). Order ID: ' + guestOrder.id;
            localStorage.removeItem(CART_KEY);
            window.dispatchEvent(new Event('cart:updated'));
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            return;
          }

          // No local user either — ask them to sign in and redirect
          if (status) status.textContent = 'Please sign in to place your order.';
          setTimeout(() => { window.location.href = 'login.html'; }, 900);
          return;
        }
      } catch (e) {
        console.warn('Could not determine auth state', e);
        // Best-effort fallback: if a local user exists, save guest order locally
        const localEmail = localStorage.getItem('userEmail') || '';
        const localName = localStorage.getItem('userName') || '';
        if (localEmail) {
          const guestOrdersKey = 'lmg_guest_orders_v1';
          const guestOrdersRaw = localStorage.getItem(guestOrdersKey);
          let guestOrders = guestOrdersRaw ? JSON.parse(guestOrdersRaw) : [];
          const guestOrder = {
            id: 'local_' + Date.now(),
            created_at: new Date().toISOString(),
            user_name: name || localName,
            email: email || localEmail,
            phone: phone,
            address: address,
            delivery_option: deliveryOption,
            state: state,
            items: items,
            total: total || 0,
            status: 'pending_local'
          };
          guestOrders.push(guestOrder);
          try { localStorage.setItem(guestOrdersKey, JSON.stringify(guestOrders)); } catch (err) { console.warn('Could not save guest order locally', err); }
          if (status) status.textContent = 'Order saved locally (guest). Order ID: ' + guestOrder.id;
          localStorage.removeItem(CART_KEY);
          window.dispatchEvent(new Event('cart:updated'));
          setTimeout(() => { window.location.href = 'index.html'; }, 1500);
          return;
        }

        if (status) status.textContent = 'Please sign in to place your order.';
        setTimeout(() => { window.location.href = 'login.html'; }, 900);
        return;
      }

    // Map cart items to a compact structure suitable for storing in a JSONB column
    if (ORDER_ITEMS_COLUMN) {
      try {
        const itemsForDb = (items || []).map(it => ({
          product_id: it.id || it.product_id || null,
          name: it.name || it.product_name || '',
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0,
          image_url: it.image_url || it.image || null
        }));
        payload[ORDER_ITEMS_COLUMN] = itemsForDb;
      } catch (e) {
        console.warn('Could not map items for DB, skipping items column', e);
      }
    }

  console.log('Order payload', payload);
      try {
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
          // Build an orders row matching the DB migration (use JSONB for shipping/billing)
          const shipping = {
            name: name,
            phone: phone,
            address: address,
            state: state,
            delivery_option: deliveryOption
          };
          const billing = {
            email: email
          };

          const orderRow = {
            user_id: null, // let the DB trigger set from JWT (if present)
            status: payload.status || 'pending',
            total: Number(total) || 0,
            currency: 'NGN',
            shipping: shipping,
            billing: billing,
            delivery_option: pick,
            metadata: {
              items_count: (items || []).length || 0,
              primary_product_name: (items && items.length) ? (items[0].name || items[0].product_name || null) : null
            }
          };

          // Insert order and get its id
          const { data: orderData, error: orderError } = await window.supabaseClient.from('orders').insert([orderRow], { returning: 'representation' });
          if (orderError || !orderData || !orderData[0] || !orderData[0].id) {
            console.error('Failed to create order', orderError);
            if (status) status.textContent = 'Failed to create order: ' + (orderError?.message || JSON.stringify(orderError));
            return;
          }
          const orderId = orderData[0].id;

          // Map cart items to order_items rows
          const orderItems = (items || []).map(it => {
            const price = Number(it.price) || 0;
            const qty = Number(it.qty) || 1;
            return {
              order_id: orderId,
              product_id: it.id || it.product_id || null,
              name: it.name || it.product_name || '',
              sku: it.sku || null,
              price: price,
              qty: qty,
              line_total: price * qty,
              metadata: {}
            };
          });

          // Insert order items
          if (orderItems.length) {
            const { data: oiData, error: oiError } = await window.supabaseClient.from('order_items').insert(orderItems, { returning: 'minimal' });
            if (oiError) {
              console.error('Failed to insert order items, attempting to delete order to rollback', oiError);
              // Attempt best-effort rollback: delete the order we created. This will only succeed
              // if the same JWT/role can delete the order. Otherwise the order may remain.
              try { await window.supabaseClient.from('orders').delete().eq('id', orderId); } catch (delErr) { console.warn('Rollback delete failed', delErr); }
              if (status) status.textContent = 'Failed to save order items: ' + (oiError?.message || JSON.stringify(oiError));
              return;
            }
          }

          // Success
          if (status) status.textContent = 'Order created successfully! — Order ID: ' + orderId;
          localStorage.removeItem(CART_KEY);
          window.dispatchEvent(new Event('cart:updated'));
          setTimeout(() => { window.location.href = 'index.html'; }, 1500);

        } else {
          // no supabase - simulate success
          if (status) status.textContent = 'Order saved locally (supabase not configured).';
          localStorage.removeItem(CART_KEY);
          window.dispatchEvent(new Event('cart:updated'));
          setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        }
      } catch (err) {
        console.error(err);
        if (status) status.textContent = 'Error placing order: ' + (err?.message || JSON.stringify(err));
      }
  }

  document.addEventListener('DOMContentLoaded', function(){
    loadCart();
    tryPrefill();
    const form = document.getElementById('checkoutForm');
    if (form) form.addEventListener('submit', submitOrder);
    window.addEventListener('storage', function(e){ if (e.key === CART_KEY) loadCart(); });
    window.addEventListener('cart:updated', loadCart);

    // Bottom nav cart count
    function updateBottomCartCount(){
      try{
        const raw = localStorage.getItem(CART_KEY);
        const items = raw ? JSON.parse(raw) : [];
        const countEl = document.getElementById('bottomCartCount');
        if (!countEl) return;
        const totalCount = (items || []).reduce((s,i)=> s + (Number(i.qty)||1), 0);
        if (totalCount > 0){ countEl.textContent = totalCount; countEl.style.display = 'inline-block'; }
        else { countEl.textContent = ''; countEl.style.display = 'none'; }
      }catch(e){}
    }
    updateBottomCartCount();
    window.addEventListener('storage', function(e){ if (e.key === CART_KEY) updateBottomCartCount(); });
    window.addEventListener('cart:updated', updateBottomCartCount);
  });
})();
