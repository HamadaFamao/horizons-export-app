-- ═══════════════════════════════════════════════════════════════════════
-- resign_ludo_game
-- Marks a player as resigned, then atomically checks team elimination.
--
-- Team mode (2v2):
--   Seats 1 & 3 → Team A   |   Seats 2 & 4 → Team B
--   If ALL players of one team have left_at set (resigned / left):
--     → finish session immediately: status='finished', winner_team, winner_id
--     → NO turn continuation as 1v1 or free-for-all
--
-- Non-team mode:
--   If only 1 active player remains → they win.
--
-- Run this in the Supabase SQL Editor (or as a migration).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION resign_ludo_game(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session      record;
  v_player       record;
  v_team_a_count int  := 0;
  v_team_b_count int  := 0;
  v_active_count int  := 0;
  v_winner_team  text := NULL;
  v_winner_id    uuid := NULL;
BEGIN

  -- ── 1. Lock and validate the session ──────────────────────────────────
  SELECT * INTO v_session
  FROM room_ludo_sessions
  WHERE id = p_session_id
    AND status = 'playing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not active or already finished');
  END IF;

  -- ── 2. Validate the player exists in this session ──────────────────────
  SELECT * INTO v_player
  FROM room_ludo_players
  WHERE session_id = p_session_id
    AND user_id    = p_user_id
    AND refunded_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in session');
  END IF;

  -- ── 3. Mark the player as resigned (left) ─────────────────────────────
  UPDATE room_ludo_players
  SET left_at = NOW()
  WHERE session_id = p_session_id
    AND user_id    = p_user_id;

  -- ── 4. Team-mode elimination check ────────────────────────────────────
  IF v_session.team_mode = true AND v_session.max_players = 4 THEN

    -- Active Team A players (seats 1 & 3) after this resign
    SELECT COUNT(*) INTO v_team_a_count
    FROM room_ludo_players
    WHERE session_id  = p_session_id
      AND refunded_at IS NULL
      AND left_at     IS NULL
      AND seat_number IN (1, 3);

    -- Active Team B players (seats 2 & 4) after this resign
    SELECT COUNT(*) INTO v_team_b_count
    FROM room_ludo_players
    WHERE session_id  = p_session_id
      AND refunded_at IS NULL
      AND left_at     IS NULL
      AND seat_number IN (2, 4);

    -- Determine winner team
    IF v_team_a_count = 0 AND v_team_b_count > 0 THEN
      v_winner_team := 'B';
      SELECT user_id INTO v_winner_id
      FROM room_ludo_players
      WHERE session_id  = p_session_id
        AND refunded_at IS NULL
        AND left_at     IS NULL
        AND seat_number IN (2, 4)
      ORDER BY seat_number
      LIMIT 1;

    ELSIF v_team_b_count = 0 AND v_team_a_count > 0 THEN
      v_winner_team := 'A';
      SELECT user_id INTO v_winner_id
      FROM room_ludo_players
      WHERE session_id  = p_session_id
        AND refunded_at IS NULL
        AND left_at     IS NULL
        AND seat_number IN (1, 3)
      ORDER BY seat_number
      LIMIT 1;
    END IF;

    -- Finish the game if a team was eliminated
    IF v_winner_team IS NOT NULL THEN
      UPDATE room_ludo_sessions
      SET status               = 'finished',
          winner_team          = v_winner_team,
          winner_id            = v_winner_id,
          current_turn_user_id = NULL
      WHERE id = p_session_id;

      RETURN jsonb_build_object(
        'success',      true,
        'resigned',     true,
        'game_ended',   true,
        'winner_team',  v_winner_team,
        'winner_id',    v_winner_id::text
      );
    END IF;

    -- Team not yet fully eliminated — just confirm the resign, let game continue
    RETURN jsonb_build_object(
      'success',    true,
      'resigned',   true,
      'game_ended', false
    );

  END IF;

  -- ── 5. Non-team mode: last player standing wins ───────────────────────
  SELECT COUNT(*) INTO v_active_count
  FROM room_ludo_players
  WHERE session_id  = p_session_id
    AND refunded_at IS NULL
    AND left_at     IS NULL;

  IF v_active_count = 1 THEN
    SELECT user_id INTO v_winner_id
    FROM room_ludo_players
    WHERE session_id  = p_session_id
      AND refunded_at IS NULL
      AND left_at     IS NULL
    LIMIT 1;

    UPDATE room_ludo_sessions
    SET status               = 'finished',
        winner_id            = v_winner_id,
        current_turn_user_id = NULL
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
      'success',    true,
      'resigned',   true,
      'game_ended', true,
      'winner_id',  v_winner_id::text
    );
  END IF;

  -- Still active players on multiple sides — game continues
  RETURN jsonb_build_object(
    'success',    true,
    'resigned',   true,
    'game_ended', false
  );

END;
$$;

-- Grant execution to authenticated users (adjust role as needed)
GRANT EXECUTE ON FUNCTION resign_ludo_game(uuid, uuid) TO authenticated;
