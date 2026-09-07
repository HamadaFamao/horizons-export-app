-- Admin Messages & Notifications System - Database Schema

-- 1. Create admin_messages table
CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  message_type TEXT[] NOT NULL DEFAULT '{"notification"}', -- ['chat', 'notification'] or both
  delivery_method TEXT[] NOT NULL DEFAULT '{"in_app"}', -- ['in_app', 'push'] or both
  send_type TEXT NOT NULL DEFAULT 'immediate', -- 'immediate' or 'scheduled'
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'sent', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER DEFAULT 0,
  CHECK (status IN ('draft', 'scheduled', 'sent', 'failed'))
);

-- 2. Create message_recipients table (tracks who received what)
CREATE TABLE IF NOT EXISTS message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_segment TEXT NOT NULL, -- 'all', 'active_famous', 'recent_chargers', 'inactive_chargers', 'new_users', 'agents', 'recharge_agents'
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- 3. Create user_segments table (for quick filtering)
CREATE TABLE IF NOT EXISTS user_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, segment_type)
);

-- 4. Create indexes for performance
CREATE INDEX idx_admin_messages_created_by ON admin_messages(created_by);
CREATE INDEX idx_admin_messages_status ON admin_messages(status);
CREATE INDEX idx_admin_messages_scheduled_at ON admin_messages(scheduled_at);
CREATE INDEX idx_message_recipients_message_id ON message_recipients(message_id);
CREATE INDEX idx_message_recipients_user_id ON message_recipients(user_id);
CREATE INDEX idx_message_recipients_is_read ON message_recipients(is_read);
CREATE INDEX idx_user_segments_user_id ON user_segments(user_id);
CREATE INDEX idx_user_segments_segment_type ON user_segments(segment_type);

-- 5. Enable RLS
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_segments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for admin_messages
-- Only staff can create/view/update messages
CREATE POLICY "admins can create messages" ON admin_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND staff_role IN ('admin', 'manager', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "admins can view all messages" ON admin_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND staff_role IN ('admin', 'manager', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "admins can update own messages" ON admin_messages
  FOR UPDATE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND staff_role IN ('admin', 'manager', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "admins can delete own messages" ON admin_messages
  FOR DELETE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND staff_role IN ('admin', 'manager', 'super_admin', 'moderator')
    )
  );

-- 7. RLS Policies for message_recipients
-- Users can view their own messages
CREATE POLICY "users can view own messages" ON message_recipients
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all messages
CREATE POLICY "admins can view message recipients" ON message_recipients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND staff_role IN ('admin', 'manager', 'super_admin', 'moderator')
    )
  );

-- System can insert (from trigger/API)
CREATE POLICY "system can insert recipients" ON message_recipients
  FOR INSERT
  WITH CHECK (true);

-- Users can mark their messages as read
CREATE POLICY "users can update own messages read status" ON message_recipients
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. RLS Policies for user_segments
CREATE POLICY "system can manage segments" ON user_segments
  FOR ALL
  USING (true);

-- 9. Trigger to update admin_messages.updated_at
CREATE OR REPLACE FUNCTION update_admin_messages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_messages_timestamp_trigger
BEFORE UPDATE ON admin_messages
FOR EACH ROW
EXECUTE FUNCTION update_admin_messages_timestamp();

-- 10. Helper function to get user segments
CREATE OR REPLACE FUNCTION get_user_segments(p_user_id UUID)
RETURNS TABLE(segment_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT segment_type
  FROM user_segments
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Verify tables exist
SELECT 'admin_messages' as table_name, count(*) as row_count FROM admin_messages
UNION ALL
SELECT 'message_recipients' as table_name, count(*) as row_count FROM message_recipients
UNION ALL
SELECT 'user_segments' as table_name, count(*) as row_count FROM user_segments;
