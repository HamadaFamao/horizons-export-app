-- Add room_level column to live_rooms table
alter table live_rooms
  add column if not exists room_level integer default 1;
