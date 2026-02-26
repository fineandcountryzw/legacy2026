-- Migration: Support standalone imports (no development required)
-- Allows stands and payments to be imported first, then assigned to a development/client later

-- 1. Make development_id nullable on payment_transactions
--    Currently it is NOT NULL which prevents standalone imports
ALTER TABLE payment_transactions
  ALTER COLUMN development_id DROP NOT NULL;

-- 2. Add stand_inventory_id column for direct linking when no development is selected
--    This allows transactions to be tied to a stand even without a development_stands record
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS stand_inventory_id uuid REFERENCES stand_inventory(id) ON DELETE SET NULL;

-- 3. Add category column to track what type of transaction it is (for deferred assignment UI)
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS category text;

-- 4. Add side column (RECEIPT or PAYMENT) for ledger side tracking
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS side text CHECK (side IN ('RECEIPT', 'PAYMENT'));

-- 5. Add sheet_name for traceability back to source Excel sheet
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS sheet_name text;

-- 6. Index for fast standalone lookup
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stand_inventory_id 
  ON payment_transactions(stand_inventory_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id_standalone
  ON payment_transactions(user_id, development_id)
  WHERE development_id IS NULL;

-- 7. Update database comment (optional but helpful)
COMMENT ON COLUMN payment_transactions.stand_inventory_id IS 
  'Direct link to stand_inventory for standalone imports (no development). Used when development_id is NULL.';

COMMENT ON COLUMN payment_transactions.development_id IS 
  'Link to development. Nullable - allows importing stands before assigning to a development.';
