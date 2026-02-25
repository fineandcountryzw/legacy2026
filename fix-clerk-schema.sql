-- =====================================================
-- FIX: Remove Supabase Auth FK constraints for Clerk compatibility
-- =====================================================

-- 1. Drop FK constraints that reference auth.users
ALTER TABLE brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_user_id_fkey;
ALTER TABLE developments DROP CONSTRAINT IF EXISTS developments_user_id_fkey;
ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_user_id_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_user_id_fkey;

-- 2. Change user_id from UUID to TEXT
ALTER TABLE brand_profiles ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE developments ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE uploads ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE payment_transactions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE clients ALTER COLUMN user_id TYPE TEXT;

-- 3. Drop and recreate RLS policies with TEXT comparison
DROP POLICY IF EXISTS "Users own their brand_profiles" ON brand_profiles;
DROP POLICY IF EXISTS "Users own their developments" ON developments;
DROP POLICY IF EXISTS "Users own their stand_types" ON development_stand_types;
DROP POLICY IF EXISTS "Users own their cost_items" ON development_cost_items;
DROP POLICY IF EXISTS "Users own their stands" ON development_stands;
DROP POLICY IF EXISTS "Users own their uploads" ON uploads;
DROP POLICY IF EXISTS "Users own their transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users own their allocations" ON transaction_allocations;
DROP POLICY IF EXISTS "Users own their clients" ON clients;
DROP POLICY IF EXISTS "Stand inventory is readable by all" ON stand_inventory;
DROP POLICY IF EXISTS "Users can insert stand_inventory" ON stand_inventory;
DROP POLICY IF EXISTS "Users can update stand_inventory" ON stand_inventory;

-- Use request.jwt.claims ->> 'sub' to get Clerk user ID as TEXT
CREATE POLICY "Users own their brand_profiles" ON brand_profiles 
  FOR ALL USING (((auth.jwt() ->> 'sub'::text) = user_id));

CREATE POLICY "Users own their developments" ON developments 
  FOR ALL USING (((auth.jwt() ->> 'sub'::text) = user_id));

CREATE POLICY "Users own their stand_types" ON development_stand_types 
  FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND (auth.jwt() ->> 'sub'::text) = d.user_id));

CREATE POLICY "Users own their cost_items" ON development_cost_items 
  FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND (auth.jwt() ->> 'sub'::text) = d.user_id));

CREATE POLICY "Users own their stands" ON development_stands 
  FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND (auth.jwt() ->> 'sub'::text) = d.user_id));

CREATE POLICY "Users own their uploads" ON uploads 
  FOR ALL USING (((auth.jwt() ->> 'sub'::text) = user_id));

CREATE POLICY "Users own their transactions" ON payment_transactions 
  FOR ALL USING (((auth.jwt() ->> 'sub'::text) = user_id));

CREATE POLICY "Users own their allocations" ON transaction_allocations 
  FOR ALL USING (EXISTS (SELECT 1 FROM payment_transactions t WHERE t.id = transaction_id AND (auth.jwt() ->> 'sub'::text) = t.user_id));

CREATE POLICY "Users own their clients" ON clients 
  FOR ALL USING (((auth.jwt() ->> 'sub'::text) = user_id));

CREATE POLICY "Stand inventory is readable by all" ON stand_inventory FOR SELECT USING (true);
CREATE POLICY "Users can insert stand_inventory" ON stand_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update stand_inventory" ON stand_inventory FOR UPDATE USING (true);

-- 4. Fix storage policies
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

CREATE POLICY "Users can upload to their own folder" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub'::text)
);

CREATE POLICY "Users can read their own uploads" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub'::text)
);

CREATE POLICY "Users can delete their own uploads" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub'::text)
);

-- 5. Create storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,
  10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

SELECT 'Schema fixed for Clerk! FK constraints to auth.users removed, user_id changed to TEXT.' as status;
