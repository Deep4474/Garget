@echo off
echo 🚀 Starting deployment to Vercel...

REM Check if Vercel CLI is installed
vercel --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Vercel CLI not found. Installing...
    npm install -g vercel
)

REM Check if user is logged in to Vercel
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo 🔐 Please login to Vercel...
    vercel login
)

REM Deploy to Vercel
echo 📦 Deploying to Vercel...
vercel --prod

echo ✅ Deployment completed!
echo 🌐 Your website is now live!
echo 📝 Don't forget to set up your environment variables in the Vercel dashboard.
echo 📖 Check DEPLOYMENT.md for detailed instructions.

pause 