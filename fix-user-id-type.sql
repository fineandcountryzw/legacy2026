-- =====================================================
-- FIX: Change user_id from UUID to TEXT for Clerk compatibility
-- Run this if you get "operator does not exist: uuid = text" error
-- =====================================================

-- Drop existing RLS policies first (they reference the columns we're changing)
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

-- Change user_id columns from UUID to TEXT
ALTER TABLE brand_profiles ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE developments ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE uploads ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE payment_transactions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE clients ALTER COLUMN user_id TYPE TEXT;

-- Recreate RLS policies with TEXT comparison
CREATE POLICY "Users own their brand_profiles" ON brand_profiles 
  FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users own their developments" ON developments 
  FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users own their stand_types" ON development_stand_types 
  FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND (auth.jwt() ->> 'sub') = d.user_id));

CREATE POLICY "Users own their cost_items" ON development_cost_items 
  FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND (auth.jwt() ->> 'sub') = d.user_id));

CREATE POLICY "Users own their stands" ON development_stands 
  FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND (auth.jwt() ->> 'sub') = d.user_id));

CREATE POLICY "Users own their uploads" ON uploads 
  FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users own their transactions" ON payment_transactions 
  FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users own their allocations" ON transaction_allocations 
  FOR ALL USING (EXISTS (SELECT 1 FROM payment_transactions t WHERE t.id = transaction_id AND (auth.jwt() ->> 'sub') = t.user_id));

CREATE POLICY "Users own their clients" ON clients 
  FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Stand inventory is readable by all" ON stand_inventory FOR SELECT USING (true);
CREATE POLICY "Users can insert stand_inventory" ON stand_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update stand_inventory" ON stand_inventory FOR UPDATE USING (true);

-- Fix storage policies too
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

CREATE POLICY "Users can upload to their own folder" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);

CREATE POLICY "Users can read their own uploads" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);

CREATE POLICY "Users can delete their own uploads" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);

SELECT 'user_id columns changed from UUID to TEXT for Clerk compatibility!' as status;
