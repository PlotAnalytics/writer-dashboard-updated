-- Add master_editor user to the database
-- This user will have special access to edit script types

-- Insert master_editor into login table
INSERT INTO login (username, password, email, role)
VALUES ('master_editor', 'Plotpointe!@3456', 'master@plotpointe.com', 'master_editor');

-- Get the login ID for master_editor
DO $$
DECLARE
    master_login_id INTEGER;
BEGIN
    SELECT id INTO master_login_id FROM login WHERE username = 'master_editor';
    
    -- Insert master_editor into writer table (for compatibility)
    INSERT INTO writer (name, login_id, payment_scale)
    VALUES ('Master Editor', master_login_id, 0);
      
    RAISE NOTICE 'Master Editor user created/updated successfully with login_id: %', master_login_id;
END $$;

-- Verify the user was created
SELECT 
    l.id as login_id,
    l.username,
    l.role,
    w.id as writer_id,
    w.name as writer_name
FROM login l
LEFT JOIN writer w ON l.id = w.login_id
WHERE l.username = 'master_editor';
