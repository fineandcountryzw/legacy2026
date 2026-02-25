-- =====================================================
-- STAND INVENTORY PLATFORM - DATABASE SETUP
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. BRAND PROFILES (Global + Per Development)
-- =====================================================
CREATE TABLE brand_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    contact_details JSONB DEFAULT '{}',
    primary_color TEXT DEFAULT '#0f172a',
    secondary_color TEXT DEFAULT '#2563eb',
    accent_color TEXT DEFAULT '#3b82f6',
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. DEVELOPMENTS
-- =====================================================
CREATE TABLE developments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'ZIG', 'ZAR')),
    developer_name TEXT NOT NULL,
    developer_contacts TEXT,
    commission_rate DECIMAL(5,4) DEFAULT 0.05,
    brand_profile_id UUID REFERENCES brand_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, code)
);

-- =====================================================
-- 3. DEVELOPMENT STAND TYPES
-- =====================================================
CREATE TABLE development_stand_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    size_sqm INTEGER NOT NULL,
    base_price DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. DEVELOPMENT COST ITEMS
-- =====================================================
CREATE TABLE development_cost_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cost_type TEXT CHECK (cost_type IN ('fixed', 'percentage', 'per_sqm', 'per_stand')),
    value DECIMAL(12,2) NOT NULL,
    applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'sold_only', 'contract_only', 'transfer_only')),
    pay_to TEXT CHECK (pay_to IN ('fine_country', 'developer', 'third_party')),
    is_variable BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. STAND INVENTORY (Canonical stands)
-- =====================================================
CREATE TABLE stand_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_stand_key TEXT UNIQUE NOT NULL,
    stand_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. DEVELOPMENT STANDS (Junction: links inventory to development)
-- =====================================================
CREATE TABLE development_stands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
    stand_inventory_id UUID REFERENCES stand_inventory(id) ON DELETE CASCADE,
    stand_type_id UUID REFERENCES development_stand_types(id),
    agreed_price DECIMAL(12,2),
    status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Sold', 'Unassigned', 'Disputed')),
    client_id UUID,
    client_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(development_id, stand_inventory_id)
);

-- =====================================================
-- 7. UPLOADS
-- =====================================================
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    development_id UUID REFERENCES developments(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    status TEXT DEFAULT 'Processing' CHECK (status IN ('Processing', 'Completed', 'Failed')),
    stands_detected INTEGER DEFAULT 0,
    transactions_detected INTEGER DEFAULT 0,
    error_message TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- 8. PAYMENT TRANSACTIONS
-- =====================================================
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
    development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES development_stands(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT,
    description TEXT,
    status TEXT DEFAULT 'Unmatched' CHECK (status IN ('Matched', 'Unmatched', 'Mismatch')),
    source_row_index INTEGER,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. TRANSACTION ALLOCATIONS
-- =====================================================
CREATE TABLE transaction_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    allocation_type TEXT CHECK (allocation_type IN ('stand_price', 'admin_fee', 'legal_fee', 'commission', 'other_cost', 'refund')),
    pay_to TEXT CHECK (pay_to IN ('fine_country', 'developer', 'third_party')),
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. CLIENTS
-- =====================================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    id_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_developments_user_id ON developments(user_id);
CREATE INDEX idx_development_stands_dev_id ON development_stands(development_id);
CREATE INDEX idx_development_stands_inv_id ON development_stands(stand_inventory_id);
CREATE INDEX idx_transactions_dev_id ON payment_transactions(development_id);
CREATE INDEX idx_transactions_stand_id ON payment_transactions(stand_id);
CREATE INDEX idx_transactions_upload_id ON payment_transactions(upload_id);
CREATE INDEX idx_allocations_transaction_id ON transaction_allocations(transaction_id);
CREATE INDEX idx_stand_inventory_key ON stand_inventory(canonical_stand_key);
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_stand_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own data
CREATE POLICY "Users own their brand_profiles" ON brand_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their developments" ON developments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their stand_types" ON development_stand_types FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND d.user_id = auth.uid()));
CREATE POLICY "Users own their cost_items" ON development_cost_items FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND d.user_id = auth.uid()));
CREATE POLICY "Users own their stands" ON development_stands FOR ALL USING (EXISTS (SELECT 1 FROM developments d WHERE d.id = development_id AND d.user_id = auth.uid()));
CREATE POLICY "Users own their uploads" ON uploads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their transactions" ON payment_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their allocations" ON transaction_allocations FOR ALL USING (EXISTS (SELECT 1 FROM payment_transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "Users own their clients" ON clients FOR ALL USING (auth.uid() = user_id);

-- Allow all users to read stand_inventory (shared canonical data)
CREATE POLICY "Stand inventory is readable by all" ON stand_inventory FOR SELECT USING (true);
CREATE POLICY "Users can insert stand_inventory" ON stand_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update stand_inventory" ON stand_inventory FOR UPDATE USING (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brand_profiles_updated_at BEFORE UPDATE ON brand_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_developments_updated_at BEFORE UPDATE ON developments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STORAGE BUCKET FOR UPLOADS
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,
  10485760, -- 10MB limit
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload to their own folder" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own uploads" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own uploads" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- DEVELOPER DETAILS COLUMNS (Migration 003)
-- =====================================================
ALTER TABLE developments 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add branding colors columns
ALTER TABLE developments 
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#0f172a',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#2563eb',
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#3b82f6';

-- Update existing rows to have default colors
UPDATE developments 
SET primary_color = '#0f172a',
    secondary_color = '#2563eb', 
    accent_color = '#3b82f6'
WHERE primary_color IS NULL;

-- =====================================================
-- DONE!
-- =====================================================
SELECT 'Database setup complete!' as status;
