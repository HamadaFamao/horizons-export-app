-- Add welcome_message column to live_rooms table
alter table live_rooms
  add column if not exists welcome_message text default 'Welcome to the room! 🎤 Respect everyone and enjoy the conversation.';
