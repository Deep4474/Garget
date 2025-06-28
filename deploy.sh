#!/bin/bash

# GOD OWN PHONE GADGET - Vercel Deployment Script

echo "🚀 Starting deployment to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel..."
    vercel login
fi

# Deploy to Vercel
echo "📦 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment completed!"
echo "🌐 Your website is now live!"
echo "📝 Don't forget to set up your environment variables in the Vercel dashboard."
echo "📖 Check DEPLOYMENT.md for detailed instructions." 