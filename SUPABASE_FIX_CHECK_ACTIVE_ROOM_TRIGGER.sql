-- 1) Inspect triggers on live_rooms
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'live_rooms'
ORDER BY trigger_name, event_manipulation;

-- 2) Fix check_active_room trigger to run on INSERT only
-- This keeps the existing trigger function if the trigger already exists.
DO $$
DECLARE
  existing_trigger_fn regprocedure;
BEGIN
  SELECT p.oid::regprocedure
  INTO existing_trigger_fn
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE n.nspname = 'public'
    AND c.relname = 'live_rooms'
    AND t.tgname = 'check_active_room'
    AND NOT t.tgisinternal
  LIMIT 1;

  EXECUTE 'DROP TRIGGER IF EXISTS check_active_room ON public.live_rooms';

  IF existing_trigger_fn IS NULL THEN
    -- Fallback if trigger was missing but function exists with default name.
    EXECUTE 'CREATE TRIGGER check_active_room BEFORE INSERT ON public.live_rooms FOR EACH ROW EXECUTE FUNCTION public.check_active_room()';
  ELSE
    EXECUTE format(
      'CREATE TRIGGER check_active_room BEFORE INSERT ON public.live_rooms FOR EACH ROW EXECUTE FUNCTION %s',
      existing_trigger_fn
    );
  END IF;
END
$$;

-- 3) Verify result (should show INSERT only for check_active_room)
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'live_rooms'
  AND trigger_name = 'check_active_room'
ORDER BY trigger_name, event_manipulation;
