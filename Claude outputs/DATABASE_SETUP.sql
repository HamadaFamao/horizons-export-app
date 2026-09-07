-- Admin Messages System - Database Setup
-- Copy and paste these queries into Supabase SQL Editor

-- Add column to staff_user_permissions table
ALTER TABLE staff_user_permissions
ADD COLUMN IF NOT EXISTS can_manage_notifications BOOLEAN DEFAULT FALSE;

-- Create admin_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  content TEXT,
  message_type VARCHAR(50),
  media_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  delivery_method VARCHAR(50)[] DEFAULT ARRAY['in_app'],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create message_recipients table if it doesn't exist
CREATE TABLE IF NOT EXISTS message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES admin_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_segment VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id
ON message_recipients(message_id);

CREATE INDEX IF NOT EXISTS idx_message_recipients_user_id
ON message_recipients(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_messages_status
ON admin_messages(status);

CREATE INDEX IF NOT EXISTS idx_admin_messages_scheduled_at
ON admin_messages(scheduled_at);

-- Enable Realtime for message_recipients table
-- Go to Supabase Dashboard → Database → Realtime → Enable for message_recipients table

-- Set up RLS (Row Level Security) policies
-- Run these after enabling Realtime

-- Allow users to read their own messages
CREATE POLICY "Users can view their own messages"
ON message_recipients
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to insert messages
CREATE POLICY "Admins can insert messages"
ON message_recipients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_user_permissions
    WHERE user_id = auth.uid()
    AND can_manage_notifications = true
  )
);

-- Allow users to update read status of their messages
CREATE POLICY "Users can mark their messages as read"
ON message_recipients
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
