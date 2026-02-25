-- Add developer contact columns to developments table
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
