-- Align user ownership columns and RLS policies with Clerk user IDs.
-- Clerk user IDs are string values like "user_xxx", not UUIDs from auth.users.

-- Drop dependent RLS policies before changing column types.
DROP POLICY IF EXISTS "Users own their brand_profiles" ON brand_profiles;
DROP POLICY IF EXISTS "Users own their developments" ON developments;
DROP POLICY IF EXISTS "Users own their stand_types" ON development_stand_types;
DROP POLICY IF EXISTS "Users own their cost_items" ON development_cost_items;
DROP POLICY IF EXISTS "Users own their stands" ON development_stands;
DROP POLICY IF EXISTS "Users own their uploads" ON uploads;
DROP POLICY IF EXISTS "Users own their transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users own their allocations" ON transaction_allocations;
DROP POLICY IF EXISTS "Users own their clients" ON clients;

-- Remove Supabase auth.users FK constraints for Clerk-managed identity.
ALTER TABLE brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_user_id_fkey;
ALTER TABLE developments DROP CONSTRAINT IF EXISTS developments_user_id_fkey;
ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_user_id_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_user_id_fkey;

-- Convert user_id columns from UUID to TEXT to store Clerk subject IDs.
ALTER TABLE brand_profiles ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE developments ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE uploads ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE payment_transactions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE clients ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Recreate ownership policies using Clerk subject claim with auth.uid() fallback.
CREATE POLICY "Users own their brand_profiles"
ON brand_profiles
FOR ALL
USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users own their developments"
ON developments
FOR ALL
USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users own their stand_types"
ON development_stand_types
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM developments d
    WHERE d.id = development_id
      AND d.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM developments d
    WHERE d.id = development_id
      AND d.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
);

CREATE POLICY "Users own their cost_items"
ON development_cost_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM developments d
    WHERE d.id = development_id
      AND d.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM developments d
    WHERE d.id = development_id
      AND d.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
);

CREATE POLICY "Users own their stands"
ON development_stands
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM developments d
    WHERE d.id = development_id
      AND d.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM developments d
    WHERE d.id = development_id
      AND d.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
);

CREATE POLICY "Users own their uploads"
ON uploads
FOR ALL
USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users own their transactions"
ON payment_transactions
FOR ALL
USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users own their allocations"
ON transaction_allocations
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM payment_transactions t
    WHERE t.id = transaction_id
      AND t.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM payment_transactions t
    WHERE t.id = transaction_id
      AND t.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
  )
);

CREATE POLICY "Users own their clients"
ON clients
FOR ALL
USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text))
WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));
