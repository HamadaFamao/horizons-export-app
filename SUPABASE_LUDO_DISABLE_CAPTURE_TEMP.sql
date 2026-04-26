-- Temporary Ludo patch: disable capture while auditing path mapping.
--
-- Goal:
-- - keep logical movement, home exit, home-lane entry, and finish behavior intact
-- - prevent any piece from being sent home by move_ludo_piece during mapping tests
-- - leave turn/dice logic untouched
--
-- This patch rewrites only the bump/capture assignment inside the live function.

DO $$
DECLARE
  v_oid oid;
  v_def text;
  v_new_def text;
BEGIN
  SELECT p.oid
    INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'move_ludo_piece'
  ORDER BY p.oid DESC
  LIMIT 1;

  IF v_oid IS NULL THEN
    RAISE NOTICE 'move_ludo_piece was not found; no capture-disable rewrite was applied.';
    RETURN;
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_new_def := v_def;

  -- Legacy capture block: replace any "send matching pieces home" update with bumped=false.
  v_new_def := regexp_replace(
    v_new_def,
    'UPDATE\s+(?:public\.)?room_ludo_players\s+SET\s+piece1\s*=\s*CASE\s+WHEN\s+piece1\s*=\s*([a-z_][a-z0-9_]*)\s+THEN\s*-1\s+ELSE\s+piece1\s+END\s*,\s*piece2\s*=\s*CASE\s+WHEN\s+piece2\s*=\s*\1\s+THEN\s*-1\s+ELSE\s+piece2\s+END\s*,\s*piece3\s*=\s*CASE\s+WHEN\s+piece3\s*=\s*\1\s+THEN\s*-1\s+ELSE\s+piece3\s+END\s*,\s*piece4\s*=\s*CASE\s+WHEN\s+piece4\s*=\s*\1\s+THEN\s*-1\s+ELSE\s+piece4\s+END\s*WHERE\s+[^;]+;\s*([a-z_][a-z0-9_]*)\s*:=\s*true\s*;',
    E'\2 := false;',
    'gi'
  );

  -- Newer guarded capture block: replace helper-based bump application with bumped=false.
  v_new_def := regexp_replace(
    v_new_def,
    'WITH\s+ludo_target\s+AS\s*\([\s\S]*?SELECT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+ludo_bump\s*\)\s+INTO\s+([a-z_][a-z0-9_]*)\s*;',
    E'\1 := false;',
    'gi'
  );

  IF v_new_def <> v_def THEN
    EXECUTE v_new_def;
  ELSE
    RAISE NOTICE 'No capture block matched the expected patterns; move_ludo_piece was not changed.';
  END IF;
END
$$;
