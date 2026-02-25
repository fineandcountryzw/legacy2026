# Stand Inventory Platform - Setup Instructions

## Step 1: Apply Database Schema

1. Go to https://app.supabase.com/project/hbtqeeftiirtosexdqgc
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Run all SQL files in `supabase/migrations` in filename order:
   - `001_initial_schema.sql`
   - `002_storage_bucket.sql`
   - `003_add_developer_details.sql`
   - `004_clerk_user_ids.sql`
5. Click **Run** for each file before moving to the next one

## Step 2: Environment Variables

Create `.env.local` file in the project root:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hbtqeeftiirtosexdqgc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E0bFQfdL4V0WsjCEp6XlvA__h73U0SY
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Get from Project Settings > API > service_role key
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Run Development Server

```bash
npm run dev
```

## Step 5: Test the Application

1. Open http://localhost:3000
2. Sign in with Clerk
3. Go to http://localhost:3000/dashboard/developments
4. Create a new development
5. Go to http://localhost:3000/dashboard/uploads
6. Upload an Excel file with stand data

## Excel File Format

Your Excel files should follow this structure:

```
Stand number 101
Date          | Amount  | Reference | Description
15/01/2024    | 5000    | DEP-001   | Initial deposit
20/02/2024    | 3000    | PAY-002   | Second payment

Stand number 102
Date          | Amount  | Reference | Description
10/01/2024    | 15000   | FULL-001  | Full payment
```

The parser will:
- Detect "Stand number XXX" headers
- Parse dates in DD/MM/YYYY format
- Extract amounts (removing currency symbols)
- Capture reference numbers
- Link payments to stands

## Troubleshooting

### "Failed to fetch developments"
- Check that the SQL schema was applied correctly
- Verify environment variables are set
- Check browser console for errors
- If you previously only applied `001` and `002`, apply `003` and `004` as well

### "Upload failed"
- Verify storage bucket "uploads" was created
- Check that service_role key is set in env
- Ensure file is .xlsx or .xls format

### RLS Policy Errors
If you see "new row violates row-level security policy":
- The user_id is not being set correctly
- Check that Clerk auth is working
- Verify the JWT is being passed to Supabase
