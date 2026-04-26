-- Fix Ludo capture / safe-block logic.
--
-- Rules enforced by this patch:
-- - Only outer-track cells can capture.
-- - Global safe/star cells can never be captured.
-- - Only a single hostile piece on the landing cell can be captured.
-- - Two or more hostile pieces on the same cell form a safe block.
-- - Team mode uses team ownership; teammates never capture each other.
-- - Classic mode uses player ownership; own pieces are never hostile.
--
-- This patch follows the existing repo pattern: define SQL helpers, then rewrite
-- the live public.move_ludo_piece function in-place via pg_get_functiondef.

CREATE OR REPLACE FUNCTION public.ludo_track_cell(
  p_piece_pos integer,
  p_seat_number integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_piece_pos BETWEEN 0 AND 50 THEN
      (p_piece_pos + CASE ((GREATEST(p_seat_number, 1) - 1) % 4)
        WHEN 0 THEN 39
        WHEN 1 THEN 26
        WHEN 2 THEN 13
        ELSE 0
      END) % 52
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.ludo_team_key(
  p_team_mode boolean,
  p_seat_number integer,
  p_user_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_team_mode, false) = true
      THEN CASE WHEN MOD(GREATEST(p_seat_number, 1), 2) = 1 THEN 'A' ELSE 'B' END
    ELSE p_user_id::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.ludo_is_safe_track_cell(
  p_track_cell integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_track_cell IN (0, 8, 13, 21, 26, 34, 39, 47);
$$;

CREATE OR REPLACE FUNCTION public.ludo_capturable_piece(
  p_session_id uuid,
  p_moving_user_id uuid,
  p_moving_seat_number integer,
  p_moving_piece_pos integer,
  p_team_mode boolean
)
RETURNS TABLE(target_user_id uuid, target_piece_number integer)
LANGUAGE sql
STABLE
AS $$
  WITH landing_ctx AS (
    SELECT
      public.ludo_track_cell(p_moving_piece_pos, p_moving_seat_number) AS landing_track_cell,
      public.ludo_team_key(p_team_mode, p_moving_seat_number, p_moving_user_id) AS moving_team_key
  ),
  cell_pieces AS (
    SELECT
      rp.user_id,
      rp.seat_number,
      public.ludo_team_key(p_team_mode, rp.seat_number, rp.user_id) AS team_key,
      piece_number,
      piece_pos,
      public.ludo_track_cell(piece_pos, rp.seat_number) AS track_cell
    FROM room_ludo_players rp
    CROSS JOIN LATERAL (
      VALUES
        (1, rp.piece1),
        (2, rp.piece2),
        (3, rp.piece3),
        (4, rp.piece4)
    ) AS pieces(piece_number, piece_pos)
    WHERE rp.session_id = p_session_id
      AND rp.refunded_at IS NULL
      AND (COALESCE(p_team_mode, false) = true OR rp.left_at IS NULL)
  ),
  hostile_landing_pieces AS (
    SELECT cp.user_id, cp.piece_number, cp.team_key
    FROM cell_pieces cp
    JOIN landing_ctx ctx
      ON cp.track_cell = ctx.landing_track_cell
    WHERE cp.user_id <> p_moving_user_id
      AND cp.track_cell IS NOT NULL
      AND NOT public.ludo_is_safe_track_cell(cp.track_cell)
      AND cp.team_key <> ctx.moving_team_key
  ),
  hostile_team_counts AS (
    SELECT team_key, COUNT(*)::integer AS team_piece_count
    FROM hostile_landing_pieces
    GROUP BY team_key
  )
  SELECT hp.user_id, hp.piece_number
  FROM hostile_landing_pieces hp
  JOIN hostile_team_counts htc
    ON htc.team_key = hp.team_key
  CROSS JOIN landing_ctx ctx
  WHERE ctx.landing_track_cell IS NOT NULL
    AND NOT public.ludo_is_safe_track_cell(ctx.landing_track_cell)
    AND (SELECT COUNT(*) FROM hostile_landing_pieces) = 1
    AND htc.team_piece_count = 1
  LIMIT 1;
$$;

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
    RAISE NOTICE 'move_ludo_piece was not found; helper functions were created but no function rewrite was applied.';
    RETURN;
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_new_def := v_def;

  -- Replace the old "send everyone on this cell home" update with a guarded
  -- single-piece capture that only affects a single hostile piece when the
  -- landing cell is capturable under the safe/block/team rules above.
  v_new_def := regexp_replace(
    v_new_def,
    'UPDATE\s+(?:public\.)?room_ludo_players\s+SET\s+piece1\s*=\s*CASE\s+WHEN\s+piece1\s*=\s*([a-z_][a-z0-9_]*)\s+THEN\s*-1\s+ELSE\s+piece1\s+END\s*,\s*piece2\s*=\s*CASE\s+WHEN\s+piece2\s*=\s*\1\s+THEN\s*-1\s+ELSE\s+piece2\s+END\s*,\s*piece3\s*=\s*CASE\s+WHEN\s+piece3\s*=\s*\1\s+THEN\s*-1\s+ELSE\s+piece3\s+END\s*,\s*piece4\s*=\s*CASE\s+WHEN\s+piece4\s*=\s*\1\s+THEN\s*-1\s+ELSE\s+piece4\s+END\s*WHERE\s+[^;]+;\s*([a-z_][a-z0-9_]*)\s*:=\s*true\s*;',
    E'WITH ludo_target AS (\n    SELECT *\n    FROM public.ludo_capturable_piece(\n      p_session_id,\n      p_user_id,\n      v_player.seat_number,\n      \1,\n      COALESCE(v_session.team_mode, false)\n    )\n  ),\n  ludo_bump AS (\n    UPDATE room_ludo_players rp\n    SET piece1 = CASE WHEN lt.target_piece_number = 1 THEN -1 ELSE rp.piece1 END,\n        piece2 = CASE WHEN lt.target_piece_number = 2 THEN -1 ELSE rp.piece2 END,\n        piece3 = CASE WHEN lt.target_piece_number = 3 THEN -1 ELSE rp.piece3 END,\n        piece4 = CASE WHEN lt.target_piece_number = 4 THEN -1 ELSE rp.piece4 END\n    FROM ludo_target lt\n    WHERE rp.session_id = p_session_id\n      AND rp.user_id = lt.target_user_id\n    RETURNING 1\n  )\n  SELECT EXISTS (SELECT 1 FROM ludo_bump) INTO \2;',
    'gi'
  );

  IF v_new_def <> v_def THEN
    EXECUTE v_new_def;
  ELSE
    RAISE NOTICE 'move_ludo_piece capture block did not match the expected legacy pattern; no rewrite applied.';
  END IF;
END
$$;
