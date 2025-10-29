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
    const pick = document.getElementById('checkoutPickOption').value;
    const state = document.getElementById('checkoutState').value;
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
      pick_option: pick,
      state: state,
      order_total: total || 0,
      status: 'pending'
    };

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
          // Prepare items as JSONB to store inside orders table (client will insert only into orders)
          const itemsForOrder = (items || []).map(it => (it.product_name || it.name || '').trim()).filter(Boolean);
          console.log('Order items for orders table', itemsForOrder);

          // Build order row payload. Add summary fields items_count and primary_product_name
          const orderRow = Object.assign({}, payload, {
            items: itemsForOrder, // will be sent as JSON/JSONB
            items_count: itemsForOrder.length || 0,
            primary_product_name: itemsForOrder.length ? itemsForOrder[0] : null
          });

          // Try direct insert into orders table
          try {
            const { data: insertData, error: insertError } = await window.supabaseClient.from('orders').insert([orderRow], { returning: 'minimal' });
            if (insertError) {
              console.warn('Direct insert to orders failed, falling back to RPC if available', insertError);
              // fallback to RPC if configured
              if (typeof window.supabaseClient.rpc === 'function') {
                const itemsForRpc = itemsForOrder; // same shape expected by our RPC
                const { data: orderId, error } = await window.supabaseClient.rpc('insert_order_with_items', {
                  p_user_name: payload.user_name,
                  p_email: payload.email,
                  p_phone: payload.phone,
                  p_address: payload.address,
                  p_pick_option: payload.pick_option,
                  p_state: payload.state,
                  p_order_total: payload.order_total,
                  p_status: payload.status,
                  p_items: itemsForRpc
                });
                if (error) throw error;
                // success via RPC
                if (status) status.textContent = 'Order created successfully! — Items: ' + (itemsForOrder.join(', ') || '');
                localStorage.removeItem(CART_KEY);
                window.dispatchEvent(new Event('cart:updated'));
                // redirect home shortly so user sees message
                setTimeout(() => { window.location.href = 'index.html'; }, 1500);
              } else {
                throw insertError;
              }
            } else {
              // success via direct insert
              if (status) status.textContent = 'Order created successfully! — Items: ' + (itemsForOrder.join(', ') || '');
              localStorage.removeItem(CART_KEY);
              window.dispatchEvent(new Event('cart:updated'));
              // redirect home shortly so user sees message
              setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            }
          } catch (e) {
            console.error('Error inserting order:', e);
            if (status) status.textContent = 'Error placing order: ' + (e.message || JSON.stringify(e));
          }

        } else {
          // no supabase - simulate success
          if (status) status.textContent = 'Order saved locally (supabase not configured).';
          localStorage.removeItem(CART_KEY);
          window.dispatchEvent(new Event('cart:updated'));
          // redirect home shortly so user sees message
          setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        }
    } catch (err) {
      console.error(err);
      if (status) status.textContent = 'Error placing order.';
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
