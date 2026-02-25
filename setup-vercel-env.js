#!/usr/bin/env node
/**
 * Vercel Environment Variables Setup Script
 * Usage: node setup-vercel-env.js
 * 
 * Make sure you're logged in: npx vercel login
 */

const { execSync } = require('child_process');

const envVars = [
  {
    name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    value: 'pk_test_ZmFzdC1zdGluZ3JheS00LmNsZXJrLmFjY291bnRzLmRldiQ',
    isPublic: true
  },
  {
    name: 'CLERK_SECRET_KEY',
    value: 'sk_test_...', // Replace with actual value
    isPublic: false
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    value: 'https://hbtqeeftiirtosexdqgc.supabase.co',
    isPublic: true
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    value: 'sb_publishable_E0bFQfdL4V0WsjCEp6XlvA__h73U0SY',
    isPublic: true
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    value: 'eyJ...', // Replace with actual value
    isPublic: false
  }
];

console.log('🚀 Setting up Vercel environment variables...\n');

// Check if linked
try {
  execSync('npx vercel project ls', { stdio: 'ignore' });
} catch (e) {
  console.log('⚠️  Project not linked. Run: npx vercel link');
  process.exit(1);
}

// Add each env var
for (const env of envVars) {
  console.log(`Adding ${env.name}...`);
  try {
    const cmd = `echo "${env.value}" | npx vercel env add ${env.name} production`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ ${env.name} added\n`);
  } catch (err) {
    console.error(`❌ Failed to add ${env.name}:`, err.message);
  }
}

console.log('\n✅ Done! Trigger a redeploy on Vercel dashboard.');
