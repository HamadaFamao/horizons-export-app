-- ═══════════════════════════════════════════════════════════════════════
-- finish_ludo_team_game
-- Finishes a 2v2 Ludo session and splits the prize equally across the
-- active winning team players.
--
-- Prize formula:
--   total_prize = floor(entry_cost * total_players * 0.9)
--   each_winner = floor(total_prize / active_winning_team_players)
--
-- winner_id stays as one representative player for compatibility.
-- winner_coins stores the PER-WINNER payout.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finish_ludo_team_game(
  p_session_id uuid,
  p_winning_team text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session record;
  v_total_players integer := 0;
  v_total_prize integer := 0;
  v_winning_player_count integer := 0;
  v_each_winner_coins integer := 0;
  v_winner_id uuid := NULL;
BEGIN
  SELECT * INTO v_session
  FROM room_ludo_sessions
  WHERE id = p_session_id
    AND status = 'playing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not active or already finished');
  END IF;

  IF v_session.team_mode IS DISTINCT FROM true OR v_session.max_players <> 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is not in team mode');
  END IF;

  IF p_winning_team NOT IN ('A', 'B') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid winning team');
  END IF;

  SELECT COUNT(*) INTO v_total_players
  FROM room_ludo_players
  WHERE session_id = p_session_id
    AND refunded_at IS NULL;

  SELECT COUNT(*) INTO v_winning_player_count
  FROM room_ludo_players
  WHERE session_id = p_session_id
    AND refunded_at IS NULL
    AND left_at IS NULL
    AND seat_number IN (
      CASE WHEN p_winning_team = 'A' THEN 1 ELSE 2 END,
      CASE WHEN p_winning_team = 'A' THEN 3 ELSE 4 END
    );

  IF v_winning_player_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active players found in winning team');
  END IF;

  v_total_prize := floor((v_session.entry_cost * v_total_players)::numeric * 0.9);
  v_each_winner_coins := floor(v_total_prize::numeric / v_winning_player_count);

  UPDATE wallets
  SET coins = coins + v_each_winner_coins
  WHERE user_id IN (
    SELECT user_id
    FROM room_ludo_players
    WHERE session_id = p_session_id
      AND refunded_at IS NULL
      AND left_at IS NULL
      AND seat_number IN (
        CASE WHEN p_winning_team = 'A' THEN 1 ELSE 2 END,
        CASE WHEN p_winning_team = 'A' THEN 3 ELSE 4 END
      )
  );

  SELECT user_id INTO v_winner_id
  FROM room_ludo_players
  WHERE session_id = p_session_id
    AND refunded_at IS NULL
    AND left_at IS NULL
    AND seat_number IN (
      CASE WHEN p_winning_team = 'A' THEN 1 ELSE 2 END,
      CASE WHEN p_winning_team = 'A' THEN 3 ELSE 4 END
    )
  ORDER BY seat_number
  LIMIT 1;

  UPDATE room_ludo_sessions
  SET status = 'finished',
      winner_team = p_winning_team,
      winner_id = v_winner_id,
      winner_coins = v_each_winner_coins,
      current_turn_user_id = NULL
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'game_ended', true,
    'winner_team', p_winning_team,
    'winner_id', v_winner_id::text,
    'winner_coins', v_each_winner_coins
  );
END;
$$;

GRANT EXECUTE ON FUNCTION finish_ludo_team_game(uuid, text) TO authenticated;

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
      RETURN finish_ludo_team_game(p_session_id, v_winner_team);
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

-- ═══════════════════════════════════════════════════════════════════════
-- Ludo resigned-player turn lock patch (classic vs team_mode)
--
-- Goal:
-- - classic mode: resigned players (left_at IS NOT NULL) are fully out of turns
-- - team_mode: resigned players remain eligible for auto-turn support
--
-- This patch rewrites function definitions in-place and intentionally does not
-- touch triple-six logic, display_roll logic, payout logic, or team result logic.
-- ═══════════════════════════════════════════════════════════════════════

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
      AND p.proname IN ('get_ludo_roll', 'move_ludo_piece', 'roll_ludo_dice')
    ORDER BY p.oid DESC
  LOOP
    SELECT pg_get_functiondef(v_rec.oid) INTO v_def;
    v_new_def := v_def;

    -- Normalize active-player filters:
    -- classic: refunded_at IS NULL AND left_at IS NULL
    -- team:    refunded_at IS NULL
    -- Applied as: refunded_at IS NULL AND (v_session.team_mode = true OR left_at IS NULL)
    v_new_def := regexp_replace(
      v_new_def,
      'AND\s+refunded_at\s+IS\s+NULL\s*(?!AND\s*\(\s*v_session\.team_mode\s*=\s*true\s+OR\s+left_at\s+IS\s+NULL\s*\))',
      E'AND refunded_at IS NULL\n    AND (v_session.team_mode = true OR left_at IS NULL) ',
      'gi'
    );

    -- If a function rejects resigned players globally, make it classic-only.
    v_new_def := regexp_replace(
      v_new_def,
      'IF\s+v_player\.left_at\s+IS\s+NOT\s+NULL\s+THEN\s*RETURN\s+jsonb_build_object\(''success'',\s*false,\s*''error'',\s*''Player resigned''\);\s*END\s+IF\s*;',
      E'IF v_player.left_at IS NOT NULL AND v_session.team_mode IS DISTINCT FROM true THEN\n    RETURN jsonb_build_object(''success'', false, ''error'', ''Player resigned'');\n  END IF;',
      'gi'
    );

    -- Ensure classic gets explicit "Player resigned" when player exists but left.
    -- Inject right before generic NOT FOUND return, only if not already present.
    IF v_new_def ~* 'IF\s+NOT\s+FOUND\s+THEN\s*RETURN\s+jsonb_build_object\(''success'',\s*false,\s*''error'',\s*''Player not found in session''\);\s*END\s+IF\s*;'
       AND v_new_def !~* '''Player resigned''' THEN
      v_new_def := regexp_replace(
        v_new_def,
        '(IF\s+NOT\s+FOUND\s+THEN\s*RETURN\s+jsonb_build_object\(''success'',\s*false,\s*''error'',\s*''Player not found in session''\);\s*END\s+IF\s*;)',
        E'IF v_session.team_mode IS DISTINCT FROM true AND EXISTS (\n    SELECT 1\n    FROM room_ludo_players\n    WHERE session_id = p_session_id\n      AND user_id = p_user_id\n      AND refunded_at IS NULL\n      AND left_at IS NOT NULL\n  ) THEN\n    RETURN jsonb_build_object(''success'', false, ''error'', ''Player resigned'');\n  END IF;\n\n  \1',
        'i'
      );
    END IF;

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END LOOP;
END
$$;
