-- =====================================================
-- User Management Tables
-- Create users table and related tables for RBAC
-- =====================================================

-- Users table (syncs with Clerk)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT, -- For non-Clerk users (optional)
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER', 'AGENT', 'FINANCE', 'AUDITOR')),
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User permissions table (for custom permissions beyond role)
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, permission)
);

-- User development assignments (for restricting access to specific developments)
CREATE TABLE IF NOT EXISTS user_development_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    development_id UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, development_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dev_assignments_user_id ON user_development_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dev_assignments_dev_id ON user_development_assignments(development_id);

-- Insert a default admin user (you'll need to update this with your Clerk ID)
-- This is a placeholder - the actual admin should be created via the app
INSERT INTO users (id, email, first_name, last_name, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@example.com',
    'Admin',
    'User',
    'ADMIN',
    true
) ON CONFLICT (email) DO NOTHING;
