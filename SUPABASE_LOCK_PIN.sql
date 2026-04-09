ALTER TABLE live_rooms
ADD COLUMN IF NOT EXISTS lock_pin text DEFAULT null;
