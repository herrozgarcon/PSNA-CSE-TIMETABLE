-- Add can_generate column to faculty_accounts if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faculty_accounts' AND column_name = 'can_generate') THEN
        ALTER TABLE faculty_accounts ADD COLUMN "can_generate" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
