(function(){
  const messagesList = document.getElementById('messagesList');
  const markAllReadBtn = document.getElementById('markAllRead');

  function ensureClient(){
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      try { window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); return window.supabaseClient; } catch(e){}
    }
    return null;
  }

  function formatTime(t){ try { return new Date(t).toLocaleString(); } catch(e){ return t; } }

  function renderMessages(items){
    if (!messagesList) return;
    const unreadBadge = document.getElementById('adminUnreadBadge');
    if (!items || items.length === 0) {
      messagesList.innerHTML = '<div class="empty">No admin messages</div>';
      if (unreadBadge) { unreadBadge.classList.add('hidden'); }
      return;
    }
    messagesList.innerHTML = '';
    items.forEach(m => {
      const el = document.createElement('div'); el.className = 'message-item' + (m.read ? '' : ' unread');
      const body = document.createElement('div'); body.className = 'message-body';
      const subj = document.createElement('div'); subj.className = 'message-subject'; subj.textContent = m.subject || m.title || 'Message';
      const txt = document.createElement('div'); txt.className = 'message-text'; txt.textContent = m.body || m.message || m.text || '';
      const when = document.createElement('div'); when.className = 'order-time'; when.textContent = formatTime(m.created_at || m.date || m.inserted_at || '');
      body.appendChild(subj); body.appendChild(txt); body.appendChild(when);
      el.appendChild(body);
      const actions = document.createElement('div'); actions.className = 'message-actions';
      const markBtn = document.createElement('button'); markBtn.className = 'btn small ghost'; markBtn.textContent = m.read ? 'Read' : 'Mark read';
      markBtn.addEventListener('click', async function(e){ e.stopPropagation(); await markMessageRead(m); refreshMessages(); });
      actions.appendChild(markBtn);
      el.appendChild(actions);
      messagesList.appendChild(el);
    });

    // update unread badge
    try{
      if (unreadBadge) {
        const count = items.filter(x => !x.read).length;
        if (count > 0) { unreadBadge.textContent = String(count); unreadBadge.classList.remove('hidden'); }
        else { unreadBadge.classList.add('hidden'); }
      }
    }catch(e){}
  }



  async function findMessagesTable(client){
    // Cache discovery result so we don't keep probing (which creates repeated 404 network responses)
    if (!window.__NOTIFICATIONS_CACHE) window.__NOTIFICATIONS_CACHE = { tableName: undefined, triedDiscovery: false };

    // If an explicit override is provided, prefer it and validate once.
    const preferred = window.NOTIFICATIONS_TABLE || (window.NOTIFICATIONS_TABLES && window.NOTIFICATIONS_TABLES[0]) || null;
    if (preferred) {
      // If we already validated this preferred name, return cached value
      if (window.__NOTIFICATIONS_CACHE.tableName === preferred) return preferred;
      try {
        const r = await client.from(preferred).select('id').limit(1);
        if (r && !r.error) { window.__NOTIFICATIONS_CACHE.tableName = preferred; return preferred; }
      } catch (e) {
        // invalid preferred table; record that discovery should run below
      }
    }

    // If we already ran discovery and found nothing, don't re-run on every poll — return cached null.
    if (window.__NOTIFICATIONS_CACHE.triedDiscovery && window.__NOTIFICATIONS_CACHE.tableName === null) return null;

    // try common table names (discovery). Keep this as a last resort.
    const candidates = ['admin_messages','messages','notifications','site_messages'];
    for (const t of candidates){
      try {
        const r = await client.from(t).select('id').limit(1);
        if (r && !r.error) { window.__NOTIFICATIONS_CACHE.tableName = t; window.__NOTIFICATIONS_CACHE.triedDiscovery = true; return t; }
      } catch(e) {
        // ignore and continue — a missing table will often return a 404 from PostgREST
      }
    }

    // mark that discovery was attempted and failed; cache null to avoid reprobing repeatedly
    window.__NOTIFICATIONS_CACHE.triedDiscovery = true;
    window.__NOTIFICATIONS_CACHE.tableName = null;
    return null;
  }

  async function fetchMessages(){
    const client = ensureClient();
    if (!client) { messagesList && (messagesList.innerHTML = '<div class="empty">Supabase not configured</div>'); return; }
    try {
      const table = await findMessagesTable(client);
      if (!table) { messagesList && (messagesList.innerHTML = '<div class="empty">No messages table found</div>'); return; }
      const res = await client.from(table).select('*').order('created_at',{ascending:false}).limit(50);
      if (res && !res.error) { renderMessages(Array.isArray(res.data)?res.data:[]); }
      else { messagesList && (messagesList.innerHTML = '<div class="empty">Error loading messages</div>'); }
    } catch(e){ messagesList && (messagesList.innerHTML = '<div class="empty">Error loading messages</div>'); }
  }

  async function markMessageRead(msg){
    const client = ensureClient(); if (!client) return;
    try {
      const table = await findMessagesTable(client); if (!table) return;
      const id = msg.id || msg.message_id || msg._id;
      if (!id) return;
      await client.from(table).update({ read: true }).eq('id', id);
    } catch(e){ console.warn('mark read failed', e); }
  }

  async function markAllRead(){
    const client = ensureClient(); if (!client) return;
    try { const table = await findMessagesTable(client); if(!table) return; await client.from(table).update({ read:true }).is('read', false); refreshMessages(); } catch(e){ console.warn('mark all read failed', e); }
  }

  function setupRealtime(){
    const client = ensureClient(); if (!client || !supabase || !supabase.createClient) return false;
    try {
      // supabase-js v2 Realtime via client.channel
      const channel = supabase.channel('realtime-notifications');
      channel.on('postgres_changes', { event: '*', schema: 'public' }, payload => { fetchMessages(); });
      channel.subscribe();
      return true;
    } catch(e){ return false; }
  }

  let pollInterval = null;
  function startPolling(){ if (pollInterval) return; pollInterval = setInterval(()=>{ fetchMessages(); }, 10000); }
  function stopPolling(){ if (pollInterval) { clearInterval(pollInterval); pollInterval = null; } }

  async function refreshMessages(){ await fetchMessages(); }

  // wire buttons
  if (markAllReadBtn) markAllReadBtn.addEventListener('click', async function(){ await markAllRead(); });

  // initial load
  fetchMessages();
  // try realtime
  const realtimeOk = setupRealtime(); if (!realtimeOk) startPolling();

})();
