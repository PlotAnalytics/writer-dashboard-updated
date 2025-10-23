-- Add spark_document column to script table
-- This column will store the Spark Document URL for Structure submissions (Remix and Re-Write types)

ALTER TABLE script 
ADD COLUMN IF NOT EXISTS spark_document TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN script.spark_document IS 'URL to Spark Document for Structure submissions (Remix and Re-Write types)';
