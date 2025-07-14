-- Add ai_chat_url column to script table
-- This column will store AI chat URLs (like ChatGPT share links) for scripts
-- The column is optional and only stored in the database, not sent to Trello

ALTER TABLE script 
ADD COLUMN IF NOT EXISTS ai_chat_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN script.ai_chat_url IS 'Optional AI chat URL (e.g., ChatGPT share link) associated with the script. Stored in database only, not sent to Trello.';
