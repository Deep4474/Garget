# Deploying GOD OWN PHONE GADGET to Vercel

## Prerequisites
1. A GitHub account
2. A Vercel account (free at vercel.com)
3. A MongoDB Atlas account (for database)

## Step 1: Set up MongoDB Atlas
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account
3. Create a new cluster
4. Get your connection string
5. Add your IP address to the whitelist (or use 0.0.0.0/0 for all IPs)

## Step 2: Prepare Your Code
1. Make sure all your code is committed to GitHub
2. Ensure your `config.env` file is not in the repository (it should be in .gitignore)

## Step 3: Deploy to Vercel

### Option A: Using Vercel CLI
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

### Option B: Using Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project settings

## Step 4: Set Environment Variables
In your Vercel dashboard, go to Settings > Environment Variables and add:

```
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_super_secret_jwt_key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
```

## Step 5: Update Frontend URLs
After deployment, update your frontend code to use the new API URL:
- Replace `http://localhost:5000` with your Vercel URL
- Update any hardcoded URLs in your JavaScript files

## Step 6: Test Your Deployment
1. Visit your Vercel URL
2. Test the main functionality
3. Check the API endpoints at `/api/health`
4. Test the admin panel

## Troubleshooting
- Check Vercel logs in the dashboard
- Ensure all environment variables are set
- Verify MongoDB connection
- Check CORS settings if needed

## Custom Domain (Optional)
1. In Vercel dashboard, go to Settings > Domains
2. Add your custom domain
3. Update DNS settings as instructed
4. Update environment variables with new domain

## Monitoring
- Use Vercel Analytics to monitor performance
- Set up error tracking with services like Sentry
- Monitor your MongoDB Atlas dashboard 