-- Fix production user_groups table to add missing created_at column
-- This should be run on your production database

-- Add the missing created_at column to user_groups table
ALTER TABLE user_groups 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Verify the table structure
\d user_groups;