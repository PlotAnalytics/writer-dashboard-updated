-- Add avatar_seed column to login table
-- This column will store the DiceBear avatar seed for consistent avatar generation
-- The column is optional and defaults to the username if not set

ALTER TABLE login 
ADD COLUMN IF NOT EXISTS avatar_seed TEXT;

-- Add comment for documentation
COMMENT ON COLUMN login.avatar_seed IS 'DiceBear avatar seed for consistent avatar generation. Defaults to username if not set.';

-- Create index for better query performance (optional)
CREATE INDEX IF NOT EXISTS idx_login_avatar_seed ON login(avatar_seed) WHERE avatar_seed IS NOT NULL;

-- Set default avatar_seed to username for existing users
UPDATE login 
SET avatar_seed = username 
WHERE avatar_seed IS NULL;

-- Show some sample results
SELECT 
  id,
  username,
  avatar_seed,
  CASE 
    WHEN avatar_seed IS NOT NULL THEN 'Has avatar seed'
    ELSE 'No avatar seed'
  END as avatar_status
FROM login 
ORDER BY id 
LIMIT 10;
