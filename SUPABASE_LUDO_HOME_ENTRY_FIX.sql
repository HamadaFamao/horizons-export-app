-- Fix Ludo home-lane entry mapping.
-- Home-entry arrow is logical position 50 for every player.
-- The next step after 50 must enter the colored home lane immediately.
-- This patch rewrites the old off-by-one branch only when it finds the exact
-- transition shape inside the live functions.

DO $$
DECLARE
  v_rec record;
  v_def text;
  v_new_def text;
BEGIN
  FOR v_rec IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('move_ludo_piece', 'get_ludo_roll', 'roll_ludo_dice')
    ORDER BY p.oid DESC
  LOOP
    SELECT pg_get_functiondef(v_rec.oid) INTO v_def;
    v_new_def := v_def;

    -- Old bug:
    --   IF target <= 51 THEN result := target;
    --   ELSIF target <= 57 THEN result := 52 + (target - 52);
    -- Correct rule:
    --   50 is the home-entry arrow
    --   51..56 map to home lane / finish immediately
    v_new_def := regexp_replace(
      v_new_def,
      'IF\s+([a-z_][a-z0-9_]*)\s*<=\s*51\s+THEN\s*([a-z_][a-z0-9_]*)\s*:=\s*\1\s*;',
      E'IF \1 <= 50 THEN\n    \2 := \1;',
      'gi'
    );

    v_new_def := regexp_replace(
      v_new_def,
      'ELSIF\s+([a-z_][a-z0-9_]*)\s*<=\s*57\s+THEN\s*([a-z_][a-z0-9_]*)\s*:=\s*52\s*\+\s*\(\s*\1\s*-\s*52\s*\)\s*;',
      E'ELSIF \1 <= 56 THEN\n    \2 := 52 + (\1 - 51);',
      'gi'
    );

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END LOOP;
END
$$;