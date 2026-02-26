-- =====================================================
-- STAND INVENTORY PLATFORM - NEON DATABASE SETUP
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. BRAND PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS brand_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS developments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'ZIG', 'ZAR')),
    developer_name TEXT NOT NULL,
    developer_contacts TEXT,
    commission_rate DECIMAL(5,4) DEFAULT 0.05,
    brand_profile_id UUID REFERENCES brand_profiles(id),
    email TEXT,
    phone TEXT,
    address TEXT,
    website TEXT,
    primary_color TEXT DEFAULT '#0f172a',
    secondary_color TEXT DEFAULT '#2563eb',
    accent_color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, code)
);

-- =====================================================
-- 3. DEVELOPMENT STAND TYPES
-- =====================================================
CREATE TABLE IF NOT EXISTS development_stand_types (
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
CREATE TABLE IF NOT EXISTS development_cost_items (
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
CREATE TABLE IF NOT EXISTS stand_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_stand_key TEXT UNIQUE NOT NULL,
    stand_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. DEVELOPMENT STANDS
-- =====================================================
CREATE TABLE IF NOT EXISTS development_stands (
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
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
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
-- 8. PAYMENT TRANSACTIONS (with standalone import support)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
    development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES development_stands(id) ON DELETE SET NULL,
    stand_inventory_id UUID REFERENCES stand_inventory(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT,
    description TEXT,
    category TEXT,
    side TEXT,
    sheet_name TEXT,
    status TEXT DEFAULT 'Unmatched' CHECK (status IN ('Matched', 'Unmatched', 'Mismatch')),
    source_row_index INTEGER,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. TRANSACTION ALLOCATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS transaction_allocations (
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
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    id_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. AUDIT EVENTS (Activity Logging)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor TEXT NOT NULL,
    actor_name TEXT NOT NULL DEFAULT 'Unknown',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_developments_user_id ON developments(user_id);
CREATE INDEX IF NOT EXISTS idx_development_stands_dev_id ON development_stands(development_id);
CREATE INDEX IF NOT EXISTS idx_development_stands_inv_id ON development_stands(stand_inventory_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dev_id ON payment_transactions(development_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stand_id ON payment_transactions(stand_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stand_inv_id ON payment_transactions(stand_inventory_id);
CREATE INDEX IF NOT EXISTS idx_transactions_upload_id ON payment_transactions(upload_id);
CREATE INDEX IF NOT EXISTS idx_allocations_transaction_id ON transaction_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stand_inventory_key ON stand_inventory(canonical_stand_key);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id ON brand_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_brand_profiles_updated_at ON brand_profiles;
DROP TRIGGER IF EXISTS update_developments_updated_at ON developments;

CREATE TRIGGER update_brand_profiles_updated_at BEFORE UPDATE ON brand_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_developments_updated_at BEFORE UPDATE ON developments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Neon database setup complete!' as status;
