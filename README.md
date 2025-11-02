Backend helper for Lamar Phone And Gadget

Files added:
- server.js — minimal Express server that exposes POST /orders and mounts /users
- user.js — Express router with admin-style user creation and lookup (uses Supabase admin API when available)
- package.json — dependencies and start script

Setup
1. Create a file named `.env` in this folder with the following values (DO NOT commit this file):

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=3000

2. Install dependencies:

# Windows PowerShell
npm install

3. Run the server:

npm start

Endpoints
- POST /orders
  - Body: { user_id?, status?, total?, currency?, shipping: {...}, billing: {...}, metadata?: {...}, items: [ { product_id, name, sku, price, qty, metadata } ] }
  - Requires the service role key (server uses it). Inserts an order and its items.

- POST /users/create
  - Body: { email, password, user_metadata? }
  - Uses supabase.auth.admin.createUser when available (service role required).

Security
- This server uses the Supabase service role key. Keep it secret and never expose it to the browser.
- Run this server on a trusted machine or platform (Heroku, Vercel Serverless, DigitalOcean, etc).

Next steps (optional)
- Add authentication (API key) for callers of this server so only your frontend can call it.
- Create an RPC on Supabase for atomic order+items creation and call that from here instead of separate inserts.
- Add rate-limiting / input validation to protect against abuse.
