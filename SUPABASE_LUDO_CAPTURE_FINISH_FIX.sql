-- Ludo capture + finish sync fix after perspective rotation.
--
-- What this patch does:
-- 1) Capture uses ACTUAL track cells only (never view/rotated cells)
-- 2) Capture only bumps one single hostile piece on a non-safe actual cell
-- 3) pieces_finished is recalculated immediately from piece1..piece4 == 57
-- 4) Adds a move_ludo_piece rewrite fallback for installs where temporary
--    capture-disable patch replaced capture with `... := false;`
--
-- NOTE: Execute this in Supabase SQL editor.

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

CREATE OR REPLACE FUNCTION public.ludo_sync_pieces_finished(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_finished integer;
BEGIN
  UPDATE room_ludo_players p
  SET pieces_finished =
      (CASE WHEN p.piece1 = 57 THEN 1 ELSE 0 END) +
      (CASE WHEN p.piece2 = 57 THEN 1 ELSE 0 END) +
      (CASE WHEN p.piece3 = 57 THEN 1 ELSE 0 END) +
      (CASE WHEN p.piece4 = 57 THEN 1 ELSE 0 END)
  WHERE p.session_id = p_session_id
    AND p.user_id = p_user_id
  RETURNING pieces_finished INTO v_finished;

  RETURN COALESCE(v_finished, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.ludo_apply_capture_after_move(
  p_session_id uuid,
  p_user_id uuid,
  p_piece_number integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_team_mode boolean := false;
  v_moving_seat_number integer;
  v_moving_piece_pos integer;
  v_target_user_id uuid;
  v_target_piece_number integer;
  v_bumped boolean := false;
BEGIN
  SELECT COALESCE(team_mode, false)
    INTO v_session_team_mode
  FROM room_ludo_sessions
  WHERE id = p_session_id;

  SELECT seat_number,
         CASE p_piece_number
           WHEN 1 THEN piece1
           WHEN 2 THEN piece2
           WHEN 3 THEN piece3
           WHEN 4 THEN piece4
           ELSE NULL
         END
    INTO v_moving_seat_number, v_moving_piece_pos
  FROM room_ludo_players
  WHERE session_id = p_session_id
    AND user_id = p_user_id
    AND refunded_at IS NULL
  LIMIT 1;

  IF v_moving_piece_pos IS NULL THEN
    RETURN false;
  END IF;

  WITH landing_ctx AS (
    SELECT
      public.ludo_track_cell(v_moving_piece_pos, v_moving_seat_number) AS landing_track_cell,
      public.ludo_team_key(v_session_team_mode, v_moving_seat_number, p_user_id) AS moving_team_key
  ),
  cell_pieces AS (
    SELECT
      rp.user_id,
      rp.seat_number,
      public.ludo_team_key(v_session_team_mode, rp.seat_number, rp.user_id) AS team_key,
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
      AND (v_session_team_mode = true OR rp.left_at IS NULL)
  ),
  hostile_landing_pieces AS (
    SELECT cp.user_id, cp.piece_number, cp.team_key
    FROM cell_pieces cp
    JOIN landing_ctx ctx
      ON cp.track_cell = ctx.landing_track_cell
    WHERE cp.user_id <> p_user_id
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
    INTO v_target_user_id, v_target_piece_number
  FROM hostile_landing_pieces hp
  JOIN hostile_team_counts htc
    ON htc.team_key = hp.team_key
  WHERE (SELECT COUNT(*) FROM hostile_landing_pieces) = 1
    AND htc.team_piece_count = 1
  LIMIT 1;

  IF v_target_user_id IS NULL OR v_target_piece_number IS NULL THEN
    RETURN false;
  END IF;

  UPDATE room_ludo_players rp
  SET piece1 = CASE WHEN v_target_piece_number = 1 THEN -1 ELSE rp.piece1 END,
      piece2 = CASE WHEN v_target_piece_number = 2 THEN -1 ELSE rp.piece2 END,
      piece3 = CASE WHEN v_target_piece_number = 3 THEN -1 ELSE rp.piece3 END,
      piece4 = CASE WHEN v_target_piece_number = 4 THEN -1 ELSE rp.piece4 END
  WHERE rp.session_id = p_session_id
    AND rp.user_id = v_target_user_id;

  PERFORM public.ludo_sync_pieces_finished(p_session_id, v_target_user_id);
  v_bumped := true;

  RETURN v_bumped;
END;
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
    RAISE NOTICE 'move_ludo_piece not found; helper functions created only.';
    RETURN;
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_new_def := v_def;

  -- If temporary patch disabled capture by setting bumped=false, restore capture call.
  v_new_def := regexp_replace(
    v_new_def,
    '([a-z_][a-z0-9_]*bumped[a-z0-9_]*)\s*:=\s*false\s*;',
    E'\1 := public.ludo_apply_capture_after_move(p_session_id, p_user_id, p_piece_number);',
    'gi'
  );

  -- Force pieces_finished sync from actual piece values whenever move_ludo_piece runs.
  -- Insert before final jsonb return if present.
  v_new_def := regexp_replace(
    v_new_def,
    '(RETURN\s+jsonb_build_object\()',
    E'PERFORM public.ludo_sync_pieces_finished(p_session_id, p_user_id);\n\n  \1',
    'i'
  );

  IF v_new_def <> v_def THEN
    EXECUTE v_new_def;
  ELSE
    RAISE NOTICE 'move_ludo_piece rewrite did not change function text (may already be fixed).';
  END IF;
END
$$;
