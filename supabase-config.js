// Supabase config for pages that include this file before `script.js`.
// NOTE: These values allow the frontend to talk to your Supabase project.
// For development you can keep them here, but DO NOT commit real keys to a
// public repository. Prefer environment-based injection (Netlify/Vercel
// build vars) or a separate `supabase-config.local.js` that's gitignored.

// Provide defaults only if not already set elsewhere (keeps backward compat).
window.SUPABASE_URL = window.SUPABASE_URL || 'https://jlwxkykznyjmstpjcgks.supabase.co';
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsd3hreWt6bnlqbXN0cGpjZ2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMTAxNDIsImV4cCI6MjA2OTg4NjE0Mn0.C86cvOOT5QI0PSHlPMujivWV8NLWMtgNiX8KrglzhIQ';

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
