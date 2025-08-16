-- Migration: Create announcements table
-- Date: 2025-08-16
-- Description: Create announcements table for admin-managed information system

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  author_id VARCHAR(255) NOT NULL,
  group_id INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_group_id ON announcements(group_id);

-- Comment on table
COMMENT ON TABLE announcements IS 'Admin-managed announcements/information system';
COMMENT ON COLUMN announcements.priority IS 'Priority level: normal, important, urgent';
COMMENT ON COLUMN announcements.group_id IS 'NULL for global announcements, specific group_id for store-specific announcements';