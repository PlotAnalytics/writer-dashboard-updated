-- Add viewer_retention_reason column to script table
-- This column will store the answer to "Why will the viewer watch till the end?" for Remix scripts
-- The column is optional and only required for Remix type submissions

ALTER TABLE script 
ADD COLUMN IF NOT EXISTS viewer_retention_reason VARCHAR(50);

-- Add comment for documentation
COMMENT ON COLUMN script.viewer_retention_reason IS 'Answer to "Why will the viewer watch till the end?" - mandatory for Remix type submissions, max 50 characters';

-- Create index for better query performance (optional)
CREATE INDEX IF NOT EXISTS idx_script_viewer_retention_reason ON script(viewer_retention_reason) WHERE viewer_retention_reason IS NOT NULL;

-- Show current table structure
\d script;
