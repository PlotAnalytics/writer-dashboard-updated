-- Update viewer_retention_reason column to allow more characters
-- Change from VARCHAR(50) to VARCHAR(500) to allow longer responses

-- First, check if the column exists and its current type
DO $$
BEGIN
    -- Check if column exists and update its length
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'script' 
        AND column_name = 'viewer_retention_reason'
    ) THEN
        -- Alter the column to increase character limit
        ALTER TABLE script 
        ALTER COLUMN viewer_retention_reason TYPE VARCHAR(500);
        
        -- Update the comment
        COMMENT ON COLUMN script.viewer_retention_reason IS 'Answer to "Why will the viewer watch till the end?" - mandatory for Remix type submissions, minimum 50 characters, max 500 characters';
        
        RAISE NOTICE 'Column viewer_retention_reason updated to VARCHAR(500)';
    ELSE
        RAISE NOTICE 'Column viewer_retention_reason does not exist';
    END IF;
END $$;

-- Verify the change
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns 
WHERE table_name = 'script' 
AND column_name = 'viewer_retention_reason';
