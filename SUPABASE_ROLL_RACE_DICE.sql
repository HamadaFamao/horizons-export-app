CREATE OR REPLACE FUNCTION roll_race_dice(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session room_race_sessions;
  v_player room_race_players;
  v_roll integer;
  v_new_position integer;
  v_next_player_id uuid;
  v_total_coins integer;
  v_platform_fee integer;
  v_winner_coins integer;
BEGIN
  SELECT * INTO v_session
  FROM room_race_sessions
  WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND OR v_session.status != 'playing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not active');
  END IF;

  IF v_session.current_turn_user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your turn');
  END IF;

  SELECT * INTO v_player
  FROM room_race_players
  WHERE session_id = p_session_id AND user_id = p_user_id;

  -- Roll two dice
  v_roll := floor(random() * 6 + 1)::integer + floor(random() * 6 + 1)::integer;
  v_new_position := LEAST(v_player.position + v_roll, v_session.track_length);

  -- Update player position
  UPDATE room_race_players
  SET position = v_new_position, last_roll = v_roll
  WHERE session_id = p_session_id AND user_id = p_user_id;

  -- Check winner
  IF v_new_position >= v_session.track_length THEN
    SELECT COUNT(*) * v_session.entry_cost INTO v_total_coins
    FROM room_race_players
    WHERE session_id = p_session_id AND refunded_at IS NULL;

    v_platform_fee := v_total_coins * v_session.platform_fee_percent / 100;
    v_winner_coins := v_total_coins - v_platform_fee;

    UPDATE wallets SET coins = coins + v_winner_coins
    WHERE user_id = p_user_id;

    UPDATE room_race_sessions
    SET status = 'finished',
        winner_id = p_user_id,
        winner_coins = v_winner_coins,
        finished_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
      'success', true,
      'roll', v_roll,
      'new_position', v_new_position,
      'winner', true,
      'winner_coins', v_winner_coins
    );
  END IF;

  -- Next player turn
  SELECT user_id INTO v_next_player_id
  FROM room_race_players
  WHERE session_id = p_session_id
    AND refunded_at IS NULL
    AND seat_number > v_player.seat_number
  ORDER BY seat_number ASC
  LIMIT 1;

  IF v_next_player_id IS NULL THEN
    SELECT user_id INTO v_next_player_id
    FROM room_race_players
    WHERE session_id = p_session_id AND refunded_at IS NULL
    ORDER BY seat_number ASC
    LIMIT 1;
  END IF;

  UPDATE room_race_sessions
  SET current_turn_user_id = v_next_player_id
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'roll', v_roll,
    'new_position', v_new_position,
    'winner', false,
    'next_turn_user_id', v_next_player_id
  );
END;
$$;

-- LUDO: display roll persistence patch
ALTER TABLE public.room_ludo_sessions
ADD COLUMN IF NOT EXISTS display_roll integer,
ADD COLUMN IF NOT EXISTS display_roll_user_id uuid;

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
    AND p.proname = 'get_ludo_roll'
  ORDER BY p.oid DESC
  LIMIT 1;

  IF v_oid IS NOT NULL THEN
    SELECT pg_get_functiondef(v_oid) INTO v_def;

    v_new_def := regexp_replace(
      v_def,
      'last_roll\\s*=\\s*v_roll',
      'last_roll = v_roll, display_roll = v_roll, display_roll_user_id = p_user_id',
      'i'
    );

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END IF;
END
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

  IF v_oid IS NOT NULL THEN
    SELECT pg_get_functiondef(v_oid) INTO v_def;
    v_new_def := v_def;

    v_new_def := regexp_replace(
      v_new_def,
      ',\\s*display_roll\\s*=\\s*0',
      '',
      'gi'
    );

    v_new_def := regexp_replace(
      v_new_def,
      ',\\s*display_roll\\s*=\\s*null',
      '',
      'gi'
    );

    v_new_def := regexp_replace(
      v_new_def,
      ',\\s*display_roll_user_id\\s*=\\s*null',
      '',
      'gi'
    );

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END IF;
END
$$;