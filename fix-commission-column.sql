-- Fix commission column to support fixed amounts (was DECIMAL(5,4) for rates like 0.05)
-- Now needs to support fixed amounts like 5000.00

ALTER TABLE developments 
ALTER COLUMN commission_rate TYPE DECIMAL(12,2);

-- Add a comment to clarify the new usage
COMMENT ON COLUMN developments.commission_rate IS 'Fixed commission amount deducted from base price for developer payout calculation';
