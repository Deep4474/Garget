// Supabase config for pages that include this file before `script.js`.
// NOTE: These values allow the frontend to talk to your Supabase project.
// For development you can keep them here, but DO NOT commit real keys to a
// public repository. Prefer environment-based injection (Netlify/Vercel
// build vars) or a separate `supabase-config.local.js` that's gitignored.

// Provide defaults only if not already set elsewhere (keeps backward compat).
// New project values provided by the user (overrides the defaults above when absent).
window.SUPABASE_URL = window.SUPABASE_URL || 'https://ahzfkfxqtdtkrwlxvimp.supabase.co';
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoemZrZnhxdGR0a3J3bHh2aW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTcyMDksImV4cCI6MjA3NzM5MzIwOX0.us--sBWAKTPJrd4gPKMPLBgtkJVhAcrUEQoD9YTnJww';

// Backwards-compatible alias: some older files expect `window.SUPABASE_KEY`.
// Ensure both variables are available and point to the anon key unless the
// developer explicitly provided an alternative earlier in the page.
window.SUPABASE_KEY = window.SUPABASE_KEY || window.SUPABASE_ANON_KEY;
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY;

// Optional: create the client here if you include the supabase SDK before this file.
// If the SDK is present and credentials are available, initialize the client
// so other scripts can use `window.supabaseClient` directly.
if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
	try {
		window.supabaseClient = window.supabaseClient || supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
	} catch (e) {
		// don't crash page load; let script.js fall back to its shim if needed
		console.warn('supabase-config: failed to create Supabase client:', e && e.message ? e.message : e);
	}
}

// Small auth helpers and header injection for login/logout UI.
// This keeps pages consistent: if a user registers and is signed in, they
// will see a Logout button in the header; clicking it signs them out.
;(function(){
	// Expose a simple signOut helper
	window.appAuth = window.appAuth || {};
	window.appAuth.signOut = async function() {
		try {
			if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.signOut === 'function') {
				await window.supabaseClient.auth.signOut();
			}
		} catch (e) {
			console.warn('signOut error', e && e.message ? e.message : e);
		}
		try { localStorage.removeItem('userEmail'); localStorage.removeItem('userName'); } catch(e){}
		// Dispatch event so other scripts can react
		try { window.dispatchEvent(new CustomEvent('auth:changed', { detail: { signedOut: true } })); } catch(e){}
		// Redirect to home (keeps UX simple)
		window.location.href = window.location.pathname.endsWith('index.html') ? 'index.html' : 'index.html';
	};

	window.appAuth.getLocalUser = function() {
		try {
			const email = localStorage.getItem('userEmail');
			const name = localStorage.getItem('userName');
			if (email) return { email, user_metadata: { full_name: name } };
		} catch(e){}
		return null;
	};

	// Add a small header control into any .header-actions container on DOM ready
	function renderHeaderAuth() {
		var containers = document.querySelectorAll('.header-actions');
		if (!containers || !containers.length) return;

		// Try to detect authenticated user: prefer Supabase session, fall back to localStorage
		(async function(){
			var user = null;
			try {
				if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.getUser === 'function') {
					const resp = await window.supabaseClient.auth.getUser();
					if (resp && resp.data && resp.data.user) user = resp.data.user;
				}
			} catch(e) { /* ignore */ }
			if (!user) user = window.appAuth.getLocalUser();

			containers.forEach(function(container){
				// avoid duplicating controls
				if (container.querySelector('.auth-control')) return;
				var wrap = document.createElement('div');
				wrap.className = 'auth-control';
				wrap.style.display = 'flex';
				wrap.style.alignItems = 'center';
				wrap.style.gap = '10px';

				if (user && user.email) {
					var nameSpan = document.createElement('span');
					nameSpan.textContent = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) ? (user.user_metadata.full_name || user.user_metadata.name) : (user.email || 'Account');
					nameSpan.style.fontSize = '0.95rem';
					nameSpan.style.color = '#222';
					wrap.appendChild(nameSpan);

					var logout = document.createElement('button');
					logout.type = 'button';
					logout.className = 'logout-btn';
					logout.textContent = 'Logout';
					logout.style.background = 'transparent';
					logout.style.border = '1px solid rgba(0,0,0,0.08)';
					logout.style.padding = '6px 10px';
					logout.style.borderRadius = '6px';
					logout.style.cursor = 'pointer';
					logout.addEventListener('click', function(){ window.appAuth.signOut(); });
					wrap.appendChild(logout);
				} else {
					var login = document.createElement('a');
					login.href = 'login.html';
					login.textContent = 'Login';
					login.style.fontWeight = '600';
					login.style.color = '#e64a19';
					wrap.appendChild(login);

					var sep = document.createElement('span'); sep.textContent = ' | '; sep.style.color = '#888'; wrap.appendChild(sep);
					var reg = document.createElement('a'); reg.href = 'register.html'; reg.textContent = 'Register'; reg.style.color = '#e64a19'; reg.style.fontWeight = '600'; wrap.appendChild(reg);
				}

				container.appendChild(wrap);
			});
		})();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderHeaderAuth); else renderHeaderAuth();
	// Re-render on auth change
	window.addEventListener('auth:changed', renderHeaderAuth);
})();

// Prevent noisy notifications table probing by default.
// If you want the client to discover your admin/messages table automatically,
// set `window.ENABLE_NOTIFICATIONS_DISCOVERY = true` before this file loads.
// If you know the table name, set `window.NOTIFICATIONS_TABLE = 'your_table_name'` before this file loads.
if (typeof window.__NOTIFICATIONS_CACHE === 'undefined') {
	if (window.NOTIFICATIONS_TABLE) {
		// If the developer explicitly provided the name, use it (no discovery needed).
		window.__NOTIFICATIONS_CACHE = { tableName: window.NOTIFICATIONS_TABLE, triedDiscovery: true };
	} else if (window.ENABLE_NOTIFICATIONS_DISCOVERY) {
		// Allow discovery (default: off). discovery will run once.
		window.__NOTIFICATIONS_CACHE = { tableName: undefined, triedDiscovery: false };
	} else {
		// Silence discovery/probing to avoid 404s. To enable discovery, set
		// window.ENABLE_NOTIFICATIONS_DISCOVERY = true or set NOTIFICATIONS_TABLE.
		window.__NOTIFICATIONS_CACHE = { tableName: null, triedDiscovery: true };
	}
}

// Optional safety: if your Supabase 'products' table doesn't always include
// a 'slug' column, pre-seed the probe cache so pages won't try to select it
// and trigger a PostgREST 400. Set to `true` if you know slug exists.
window.__PRODUCTS_COLUMNS = window.__PRODUCTS_COLUMNS || {};
if (typeof window.__PRODUCTS_COLUMNS['slug'] === 'undefined') {
  // Defensive default: assume slug not present to avoid 400s. Change to `true`
  // if your DB does include a slug column.
  window.__PRODUCTS_COLUMNS['slug'] = false;
}
