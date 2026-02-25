@echo off
echo ==========================================
echo Vercel Environment Variables Setup
echo ==========================================
echo.
echo This will guide you through:
echo 1. Linking to your Vercel project
echo 2. Adding all required environment variables
echo.
pause

REM Link project
echo.
echo [1/6] Linking to Vercel project...
npx vercel link

REM Add Clerk Publishable Key
echo.
echo [2/6] Adding NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY...
echo Leave as is | npx vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
echo pk_test_ZmFzdC1zdGluZ3JheS00LmNsZXJrLmFjY291bnRzLmRldiQ

REM Add Clerk Secret
echo.
echo [3/6] Adding CLERK_SECRET_KEY...
npx vercel env add CLERK_SECRET_KEY production
echo sk_test_...

REM Add Supabase URL
echo.
echo [4/6] Adding NEXT_PUBLIC_SUPABASE_URL...
echo Leave as is | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo https://hbtqeeftiirtosexdqgc.supabase.co

REM Add Supabase Anon Key
echo.
echo [5/6] Adding NEXT_PUBLIC_SUPABASE_ANON_KEY...
echo Leave as is | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo sb_publishable_E0bFQfdL4V0WsjCEp6XlvA__h73U0SY

REM Add Service Role Key
echo.
echo [6/6] Adding SUPABASE_SERVICE_ROLE_KEY...
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo eyJ...

echo.
echo ==========================================
echo Setup complete! Trigger a redeploy on Vercel.
echo ==========================================
pause
