-- =====================================================
-- LAKECITY ACCOUNTING SUITE - COMPLETE SCHEMA
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USER MANAGEMENT & RBAC
-- =====================================================

-- Users table (extends Clerk auth with local RBAC)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id TEXT UNIQUE, -- Link to Clerk auth if still used
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- For local auth fallback
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'VIEWER', -- ADMIN, MANAGER, ACCOUNTANT, VIEWER
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User permissions (granular - overrides role defaults)
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL, -- RECORD_PAYMENT, APPROVE_PAYOUT, UPLOAD_LEDGER, etc.
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, permission)
);

-- User development assignments (for accountants)
CREATE TABLE IF NOT EXISTS user_development_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, development_id)
);

-- Login sessions (for local auth)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. ENHANCED ACCOUNTING SCHEMA
-- =====================================================

-- Add accounting columns to existing developments table
ALTER TABLE developments 
    ADD COLUMN IF NOT EXISTS accounting_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS default_payment_terms VARCHAR(20) DEFAULT 'INSTALLMENT'; -- CASH, INSTALLMENT

-- Add accounting columns to existing development_stands table
ALTER TABLE development_stands
    ADD COLUMN IF NOT EXISTS agent_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS client_email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sale_price DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS sale_date DATE,
    ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(20), -- CASH, INSTALLMENT
    ADD COLUMN IF NOT EXISTS total_deposits DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_installments DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_customer_payments DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_deductions DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accounting_status VARCHAR(20) DEFAULT 'ACTIVE'; -- ACTIVE, COMPLETED, CANCELLED

-- Customer Payments (enhanced from payment_transactions)
CREATE TABLE IF NOT EXISTS customer_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stand_id UUID NOT NULL REFERENCES development_stands(id),
    payment_date DATE NOT NULL,
    payment_type VARCHAR(20) NOT NULL, -- DEPOSIT, INSTALLMENT, ADMIN_FEE, LEGAL_FEE
    description TEXT NOT NULL,
    invoice_ref VARCHAR(50),
    amount DECIMAL(12,2) NOT NULL,
    
    -- Source tracking
    source VARCHAR(20) DEFAULT 'EXCEL_UPLOAD', -- EXCEL_UPLOAD, MANUAL_ENTRY, CASH_PAYMENT
    source_id UUID, -- reference to cash_payments if applicable
    
    -- Recording info
    recorded_by UUID REFERENCES users(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- For cash payments
    receipt_number VARCHAR(50),
    
    -- Excel import tracking
    original_sheet VARCHAR(100),
    original_row_index INTEGER,
    
    -- Link to legacy transaction
    legacy_transaction_id UUID REFERENCES payment_transactions(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deductions (for developer payouts, commissions, etc.)
CREATE TABLE IF NOT EXISTS deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stand_id UUID NOT NULL REFERENCES development_stands(id),
    deduction_date DATE NOT NULL,
    deduction_type VARCHAR(20) NOT NULL, -- COMMISSION, ADMIN_FEE, AOS, DEVELOPER, REALTOR, LEGAL_FEE
    description TEXT NOT NULL,
    ack_ref VARCHAR(50),
    amount DECIMAL(12,2) NOT NULL,
    recipient VARCHAR(100) NOT NULL,
    
    -- Source tracking
    source VARCHAR(20) DEFAULT 'EXCEL_UPLOAD',
    
    -- Recording info
    recorded_by UUID REFERENCES users(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Excel import tracking
    original_sheet VARCHAR(100),
    original_row_index INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Payments (manual cash receipts)
CREATE TABLE IF NOT EXISTS cash_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stand_id UUID NOT NULL REFERENCES development_stands(id),
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    payment_type VARCHAR(20) NOT NULL, -- DEPOSIT, INSTALLMENT
    amount DECIMAL(12,2) NOT NULL,
    received_by VARCHAR(100),
    notes TEXT,
    
    -- Recording info
    recorded_by UUID REFERENCES users(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Link to customer_payments
    customer_payment_id UUID REFERENCES customer_payments(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. DEVELOPER PAYOUT WORKFLOW
-- =====================================================

-- Developer payouts (with approval workflow)
CREATE TABLE IF NOT EXISTS developer_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stand_id UUID NOT NULL REFERENCES development_stands(id),
    development_id UUID NOT NULL REFERENCES developments(id),
    developer_name VARCHAR(100) NOT NULL, -- Lakecity, Highrange, etc.
    
    -- Payout details
    payout_type VARCHAR(20) NOT NULL, -- INSTALLMENT, COMPLETION, COMMISSION
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    
    -- Status workflow
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, PAID
    
    -- Request info
    requested_by UUID REFERENCES users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Approval info
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Payment info (when paid)
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(20), -- BANK_TRANSFER, CASH, CHEQUE
    payment_reference VARCHAR(100),
    
    -- Related deductions (link to deductions table)
    related_deduction_ids UUID[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout approval history
CREATE TABLE IF NOT EXISTS payout_approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_id UUID NOT NULL REFERENCES developer_payouts(id),
    action VARCHAR(20) NOT NULL, -- REQUESTED, APPROVED, REJECTED, PAID
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    old_status VARCHAR(20),
    new_status VARCHAR(20)
);

-- =====================================================
-- 4. RECONCILIATIONS
-- =====================================================

-- Monthly/Periodic reconciliations
CREATE TABLE IF NOT EXISTS reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    development_id UUID REFERENCES developments(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Opening balances
    opening_customer_payments DECIMAL(12,2) DEFAULT 0,
    opening_deductions DECIMAL(12,2) DEFAULT 0,
    opening_balance DECIMAL(12,2) DEFAULT 0,
    
    -- Period transactions
    period_customer_payments DECIMAL(12,2) DEFAULT 0,
    period_deductions DECIMAL(12,2) DEFAULT 0,
    
    -- Closing balances
    closing_customer_payments DECIMAL(12,2) DEFAULT 0,
    closing_deductions DECIMAL(12,2) DEFAULT 0,
    closing_balance DECIMAL(12,2) DEFAULT 0,
    
    -- Reconciliation status
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, RECONCILED, APPROVED
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(development_id, period_start, period_end)
);

-- =====================================================
-- 5. ENHANCED AUDIT LOG
-- =====================================================

-- Extend existing audit_events with more comprehensive tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- USER, STAND, PAYMENT, DEDUCTION, PAYOUT, etc.
    entity_id UUID,
    development_id UUID REFERENCES developments(id),
    stand_id UUID REFERENCES development_stands(id),
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    
    -- User tracking
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Context
    reason TEXT,
    session_id UUID,
    
    -- Link to legacy audit_events
    legacy_audit_id UUID REFERENCES audit_events(id)
);

-- =====================================================
-- 6. STAND TRANSFERS
-- =====================================================

CREATE TABLE IF NOT EXISTS stand_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stand_id UUID NOT NULL REFERENCES development_stands(id),
    old_client_name TEXT,
    old_client_phone VARCHAR(20),
    old_client_email VARCHAR(100),
    new_client_name TEXT NOT NULL,
    new_client_phone VARCHAR(20),
    new_client_email VARCHAR(100),
    transfer_date DATE NOT NULL,
    transfer_fee DECIMAL(12,2) DEFAULT 0,
    transferred_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dev_assignments_user_id ON user_development_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dev_assignments_dev_id ON user_development_assignments(development_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);

-- Customer payments indexes
CREATE INDEX IF NOT EXISTS idx_customer_payments_stand_id ON customer_payments(stand_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_customer_payments_recorded_by ON customer_payments(recorded_by);

-- Deductions indexes
CREATE INDEX IF NOT EXISTS idx_deductions_stand_id ON deductions(stand_id);
CREATE INDEX IF NOT EXISTS idx_deductions_recipient ON deductions(recipient);
CREATE INDEX IF NOT EXISTS idx_deductions_type ON deductions(deduction_type);

-- Cash payments indexes
CREATE INDEX IF NOT EXISTS idx_cash_payments_stand_id ON cash_payments(stand_id);
CREATE INDEX IF NOT EXISTS idx_cash_payments_receipt ON cash_payments(receipt_number);

-- Developer payouts indexes
CREATE INDEX IF NOT EXISTS idx_developer_payouts_status ON developer_payouts(status);
CREATE INDEX IF NOT EXISTS idx_developer_payouts_stand ON developer_payouts(stand_id);
CREATE INDEX IF NOT EXISTS idx_developer_payouts_development ON developer_payouts(development_id);
CREATE INDEX IF NOT EXISTS idx_developer_payouts_developer ON developer_payouts(developer_name);

-- Payout history indexes
CREATE INDEX IF NOT EXISTS idx_payout_history_payout_id ON payout_approval_history(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_performed ON payout_approval_history(performed_by, performed_at);

-- Reconciliation indexes
CREATE INDEX IF NOT EXISTS idx_reconciliations_development ON reconciliations(development_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_period ON reconciliations(period_start, period_end);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed ON audit_log(performed_by, performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_development ON audit_log(development_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_stand ON audit_log(stand_id);

-- Stand transfers indexes
CREATE INDEX IF NOT EXISTS idx_stand_transfers_stand_id ON stand_transfers(stand_id);

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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_developer_payouts_updated_at ON developer_payouts;

-- Create triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_developer_payouts_updated_at BEFORE UPDATE ON developer_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Insert default admin user (password should be changed immediately)
-- Password hash is for 'admin123' - bcrypt hashed
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES (
    'admin@lakecity.com', 
    '$2b$10$YourHashHere', -- Replace with actual bcrypt hash
    'System', 
    'Administrator', 
    'ADMIN', 
    true
)
ON CONFLICT (email) DO NOTHING;

SELECT 'Lakecity Accounting Suite schema created successfully!' as status;
