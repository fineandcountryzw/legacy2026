# Vercel Environment Variables Setup Script
# Run this to add all required env vars to your Vercel project

Write-Host "Setting up Vercel environment variables..." -ForegroundColor Green

# Clerk
npx vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
npx vercel env add CLERK_SECRET_KEY production

# Supabase  
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production

Write-Host "Done! Now trigger a new deployment on Vercel dashboard." -ForegroundColor Green
