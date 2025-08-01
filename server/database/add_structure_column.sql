-- Add structure column to script table
-- This column will store the structure name selected by the writer
-- The column is optional and stores the structure choice separately from the title

ALTER TABLE script 
ADD COLUMN IF NOT EXISTS structure TEXT;

-- Add comment for documentation
COMMENT ON COLUMN script.structure IS 'Structure name selected by the writer (e.g., Three Act Structure, Hero Journey)';

-- Create index for better query performance (optional)
CREATE INDEX IF NOT EXISTS idx_script_structure ON script(structure) WHERE structure IS NOT NULL;

-- Update existing records to extract structure from title if possible
-- This is a one-time migration to populate existing data
UPDATE script 
SET structure = CASE 
  WHEN title ~ '^\[([^\]]+)\]' THEN 
    substring(title from '^\[([^\]]+)\]')
  ELSE NULL
END
WHERE structure IS NULL 
  AND title ~ '^\[([^\]]+)\]';

-- Show some sample results
SELECT 
  id,
  title,
  structure,
  CASE 
    WHEN structure IS NOT NULL THEN 'Extracted'
    ELSE 'No structure found'
  END as migration_status
FROM script 
ORDER BY id DESC 
LIMIT 10;
