-- Fix duplicate empty email constraint issue in production
-- This script converts empty string emails to NULL to allow multiple users without email

-- Step 1: Update all empty string emails to NULL
UPDATE users 
SET email = NULL 
WHERE email = '' OR email IS NULL OR TRIM(email) = '';

-- Step 2: Verify the change
SELECT 'Users with NULL email:' as status, COUNT(*) as count 
FROM users 
WHERE email IS NULL;

-- Step 3: Verify no empty string emails remain
SELECT 'Users with empty string email:' as status, COUNT(*) as count 
FROM users 
WHERE email = '';

-- Step 4: Show sample of updated users
SELECT id, username, 
       CASE 
         WHEN email IS NULL THEN '[NULL]' 
         ELSE email 
       END as email_display,
       role 
FROM users 
ORDER BY username 
LIMIT 10;