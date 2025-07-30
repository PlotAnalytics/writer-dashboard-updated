-- Add core_concept_doc column to script table
-- This column will store Core Concept Doc URLs for Remix scripts
-- The column is optional and only required for Remix type submissions

ALTER TABLE script 
ADD COLUMN IF NOT EXISTS core_concept_doc TEXT;

-- Add comment for documentation
COMMENT ON COLUMN script.core_concept_doc IS 'Core Concept Doc URL for Remix scripts - mandatory for Remix type submissions';

-- Create index for better query performance (optional)
CREATE INDEX IF NOT EXISTS idx_script_core_concept_doc ON script(core_concept_doc) WHERE core_concept_doc IS NOT NULL;
