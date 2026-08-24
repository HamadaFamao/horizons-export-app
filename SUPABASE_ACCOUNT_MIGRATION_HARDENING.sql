-- ════════════════════════════════════════════════════════════════════════
-- SUPABASE_ACCOUNT_MIGRATION_HARDENING.sql
--
-- Required database changes for the Account Migration admin feature
-- (see ACCOUNT_MIGRATION.md and ACCOUNT_MIGRATION_SCHEMA.md at the project
-- root). Adds:
--
--   1. `admin_audit_log` — the table `supabase/functions/admin-account-migration/
--      index.ts` reads and writes for both dry runs and real executions, and
--      that `MigrationHistoryPage` lists. Created with RLS enabled and no
--      policies, so it is reachable only by roles that bypass RLS
--      (service_role, and this file's SECURITY DEFINER function).
--
--   2. `admin_migration_already_done(uuid)` — idempotency check used by both
--      the edge function (best-effort, pre-flight) and `admin_migrate_account`
--      (authoritative, pre-write).
--
--   3. `admin_migrate_account(...)` — the single Postgres function that
--      performs every write of a real (non-dry-run) migration inside one
--      transaction: wallet merge, bulk-reassign tables, two-sided
--      relationship tables (+ self-pair cleanup), sender tables. On any
--      failure, an inner BEGIN/EXCEPTION block rolls back everything since
--      the start of the migration (via an implicit savepoint) and still
--      records a `result = 'failure'` audit row — nothing is left partially
--      migrated, and no failed attempt goes unlogged.
--
-- Table/column scope here is intentionally identical to `REASSIGN_TABLES` /
-- `RELATIONSHIP_TABLES` / `SENDER_TABLES` / `WALLET_TABLE` at the top of
-- `supabase/functions/admin-account-migration/index.ts` — keep the two in
-- sync if that list ever changes.
--
-- Safe to run more than once (every statement is guarded with
-- IF NOT EXISTS / CREATE OR REPLACE).
-- ════════════════════════════════════════════════════════════════════════

-- ── Extensions ─────────────────────────────────────────────────────────
-- gen_random_uuid() for the audit table's primary key.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Trigram indexes below speed up the ILIKE search MigrationHistoryPage runs
-- across name/email columns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ════════════════════════════════════════════════════════════════════════
-- 1. admin_audit_log
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action             text NOT NULL,
  performed_by       uuid NOT NULL,
  old_user_id        uuid NOT NULL,
  new_user_id        uuid NOT NULL,
  dry_run            boolean NOT NULL DEFAULT false,
  result             text NOT NULL CHECK (result IN ('success', 'failure')),
  caller_email       text,
  caller_name        text,
  ip_address         text,
  user_agent         text,
  execution_time_ms  integer,
  total_rows         integer,
  old_user_email     text,
  old_user_name      text,
  new_user_email     text,
  new_user_name      text,
  details            jsonb,
  warnings           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Columns that may not exist yet if an older, pre-hardening version of this
-- table was created by hand — add them idempotently.
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS caller_email      text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS caller_name       text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS ip_address        text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS user_agent        text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS execution_time_ms integer;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS total_rows        integer;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS old_user_email    text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS old_user_name     text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS new_user_email    text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS new_user_name     text;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS warnings          jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Query patterns to support:
--  - checkAlreadyMigrated(): action + old_user_id + dry_run + result, newest first
--  - MigrationHistoryPage list: action, ordered by created_at desc, paginated
--  - MigrationHistoryPage search: ILIKE across old/new user+caller name/email
CREATE INDEX IF NOT EXISTS admin_audit_log_action_created_at_idx
  ON public.admin_audit_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_old_user_lookup_idx
  ON public.admin_audit_log (old_user_id, action, dry_run, result, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_new_user_id_idx
  ON public.admin_audit_log (new_user_id);

CREATE INDEX IF NOT EXISTS admin_audit_log_old_user_email_trgm_idx
  ON public.admin_audit_log USING gin (old_user_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS admin_audit_log_old_user_name_trgm_idx
  ON public.admin_audit_log USING gin (old_user_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS admin_audit_log_new_user_email_trgm_idx
  ON public.admin_audit_log USING gin (new_user_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS admin_audit_log_new_user_name_trgm_idx
  ON public.admin_audit_log USING gin (new_user_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS admin_audit_log_caller_email_trgm_idx
  ON public.admin_audit_log USING gin (caller_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS admin_audit_log_caller_name_trgm_idx
  ON public.admin_audit_log USING gin (caller_name gin_trgm_ops);

-- Intentionally enabled with NO policies: unreadable/unwritable to `anon`
-- and `authenticated` sessions. Only roles that bypass RLS — `service_role`
-- (used directly by the edge function for lookups/history/dry-run inserts)
-- and this file's SECURITY DEFINER function owner — can touch it.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════
-- 2. admin_migration_already_done(uuid)
--    Idempotency check: has `p_old_user_id` already been the source of a
--    successful, non-dry-run migration?
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_migration_already_done(p_old_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_audit_log
    WHERE action = 'admin_account_migration'
      AND old_user_id = p_old_user_id
      AND dry_run = false
      AND result = 'success'
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_migration_already_done(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_migration_already_done(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_migration_already_done(uuid) TO service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 3. admin_migrate_account(...)
--    The transactional migration itself. Mirrors REASSIGN_TABLES /
--    RELATIONSHIP_TABLES / SENDER_TABLES / WALLET_TABLE from
--    supabase/functions/admin-account-migration/index.ts exactly.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_migrate_account(
  p_old_user_id   uuid,
  p_new_user_id   uuid,
  p_caller_id     uuid,
  p_caller_email  text,
  p_caller_name   text,
  p_ip_address    text,
  p_user_agent    text,
  p_old_user_email text,
  p_old_user_name  text,
  p_new_user_email text,
  p_new_user_name  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time        timestamptz := clock_timestamp();
  v_execution_time_ms  integer;
  v_total_rows         integer := 0;

  v_reassign_report      jsonb := '[]'::jsonb;
  v_relationship_report  jsonb := '[]'::jsonb;
  v_sender_report        jsonb := '[]'::jsonb;
  v_wallet_report         jsonb := '{}'::jsonb;

  v_old_wallet  record;
  v_new_wallet  record;

  v_table   text;
  v_column  text;
  v_col1    text;
  v_col2    text;
  v_row_count integer;
  v_count1  integer;
  v_count2  integer;
  v_cleanup integer;

  v_error_message text;
  v_error_detail  text;
  v_error_context text;
BEGIN
  -- ── Basic argument validation ──────────────────────────────────────
  IF p_old_user_id IS NULL OR p_new_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'oldUserId and newUserId are required');
  END IF;

  IF p_old_user_id = p_new_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'oldUserId and newUserId must be different');
  END IF;

  -- ── Idempotency guard (authoritative — see admin_migration_already_done) ─
  IF public.admin_migration_already_done(p_old_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already migrated.');
  END IF;

  -- ── All writes below happen in one inner block. If anything raises,
  --    everything since here rolls back (implicit savepoint) and a
  --    `failure` audit row is written instead, before returning. ──────────
  BEGIN

    -- ── Wallet merge (WALLET_TABLE) ────────────────────────────────────
    -- One row per user (unique user_id) — cannot be blindly reassigned
    -- without colliding with newUserId's own wallet. Coins/gems are
    -- summed (currency); level/xp take the higher of the two (progress,
    -- not currency — summing would inflate it).
    SELECT coins, gems, level, xp INTO v_old_wallet
      FROM public.wallets WHERE user_id = p_old_user_id FOR UPDATE;
    SELECT coins, gems, level, xp INTO v_new_wallet
      FROM public.wallets WHERE user_id = p_new_user_id FOR UPDATE;

    IF v_old_wallet IS NOT NULL AND v_new_wallet IS NOT NULL THEN
      UPDATE public.wallets
      SET coins = COALESCE(v_new_wallet.coins, 0) + COALESCE(v_old_wallet.coins, 0),
          gems  = COALESCE(v_new_wallet.gems, 0)  + COALESCE(v_old_wallet.gems, 0),
          level = GREATEST(COALESCE(v_new_wallet.level, 0), COALESCE(v_old_wallet.level, 0)),
          xp    = GREATEST(COALESCE(v_new_wallet.xp, 0), COALESCE(v_old_wallet.xp, 0))
      WHERE user_id = p_new_user_id;

      DELETE FROM public.wallets WHERE user_id = p_old_user_id;

      v_wallet_report := jsonb_build_object(
        'action', 'merged',
        'oldWallet', to_jsonb(v_old_wallet),
        'newWalletBefore', to_jsonb(v_new_wallet),
        'newWalletAfter', jsonb_build_object(
          'coins', COALESCE(v_new_wallet.coins, 0) + COALESCE(v_old_wallet.coins, 0),
          'gems',  COALESCE(v_new_wallet.gems, 0)  + COALESCE(v_old_wallet.gems, 0),
          'level', GREATEST(COALESCE(v_new_wallet.level, 0), COALESCE(v_old_wallet.level, 0)),
          'xp',    GREATEST(COALESCE(v_new_wallet.xp, 0), COALESCE(v_old_wallet.xp, 0))
        )
      );
      v_total_rows := v_total_rows + 1;

    ELSIF v_old_wallet IS NOT NULL AND v_new_wallet IS NULL THEN
      UPDATE public.wallets SET user_id = p_new_user_id WHERE user_id = p_old_user_id;

      v_wallet_report := jsonb_build_object(
        'action', 'reassigned',
        'oldWallet', to_jsonb(v_old_wallet)
      );
      v_total_rows := v_total_rows + 1;

    ELSE
      v_wallet_report := jsonb_build_object('action', 'none');
    END IF;

    -- ── Bulk reassign tables (REASSIGN_TABLES) ─────────────────────────
    FOR v_table, v_column IN
      SELECT * FROM (VALUES
        ('photos',                  'user_id'),
        ('reward_history',          'user_id'),
        ('user_bans',                'user_id'),
        ('unread_messages',          'user_id'),
        ('live_room_participants',   'user_id'),
        ('live_room_follows',        'user_id'),
        ('agency_memberships',       'user_id'),
        ('gem_withdrawal_requests',  'user_id'),
        ('recharge_agents',          'user_id')
      ) AS t(table_name, column_name)
    LOOP
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', v_table, v_column, v_column)
        USING p_new_user_id, p_old_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;

      v_reassign_report := v_reassign_report || jsonb_build_object(
        'table', v_table, 'column', v_column, 'matched', v_row_count
      );
      v_total_rows := v_total_rows + v_row_count;
    END LOOP;

    -- ── Relationship tables (RELATIONSHIP_TABLES) ──────────────────────
    -- Both columns are reassigned, then any row now pointing at
    -- newUserId on both sides (old and new already had a row with each
    -- other) is removed as a self-pair byproduct of the merge.
    FOR v_table, v_col1, v_col2 IN
      SELECT * FROM (VALUES
        ('blocks',  'blocker', 'blocked'),
        ('threads', 'user_a',  'user_b'),
        ('matches', 'user_a',  'user_b')
      ) AS t(table_name, column_a, column_b)
    LOOP
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', v_table, v_col1, v_col1)
        USING p_new_user_id, p_old_user_id;
      GET DIAGNOSTICS v_count1 = ROW_COUNT;

      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', v_table, v_col2, v_col2)
        USING p_new_user_id, p_old_user_id;
      GET DIAGNOSTICS v_count2 = ROW_COUNT;

      EXECUTE format('DELETE FROM public.%I WHERE %I = $1 AND %I = $1', v_table, v_col1, v_col2)
        USING p_new_user_id;
      GET DIAGNOSTICS v_cleanup = ROW_COUNT;

      v_relationship_report := v_relationship_report || jsonb_build_object(
        'table', v_table,
        'columns', jsonb_build_array(v_col1, v_col2),
        'matched', v_count1 + v_count2,
        'selfPairsRemoved', v_cleanup
      );
      v_total_rows := v_total_rows + v_count1 + v_count2;
    END LOOP;

    -- ── Sender tables (SENDER_TABLES) ──────────────────────────────────
    FOR v_table, v_column IN
      SELECT * FROM (VALUES
        ('messages', 'sender_id')
      ) AS t(table_name, column_name)
    LOOP
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', v_table, v_column, v_column)
        USING p_new_user_id, p_old_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;

      v_sender_report := v_sender_report || jsonb_build_object(
        'table', v_table, 'column', v_column, 'matched', v_row_count
      );
      v_total_rows := v_total_rows + v_row_count;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_error_message = MESSAGE_TEXT,
      v_error_detail  = PG_EXCEPTION_DETAIL,
      v_error_context = PG_EXCEPTION_CONTEXT;

    v_execution_time_ms := CEIL(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000);

    INSERT INTO public.admin_audit_log (
      action, performed_by, old_user_id, new_user_id, dry_run, result,
      caller_email, caller_name, ip_address, user_agent, execution_time_ms, total_rows,
      old_user_email, old_user_name, new_user_email, new_user_name,
      details, warnings, created_at
    ) VALUES (
      'admin_account_migration', p_caller_id, p_old_user_id, p_new_user_id, false, 'failure',
      p_caller_email, p_caller_name, p_ip_address, p_user_agent, v_execution_time_ms, v_total_rows,
      p_old_user_email, p_old_user_name, p_new_user_email, p_new_user_name,
      jsonb_build_object(
        'error', v_error_message,
        'detail', v_error_detail,
        'context', v_error_context,
        'partial', jsonb_build_object(
          'reassignTables', v_reassign_report,
          'relationshipTables', v_relationship_report,
          'senderTables', v_sender_report,
          'wallet', v_wallet_report
        )
      ),
      '[]'::jsonb, now()
    );

    RETURN jsonb_build_object('success', false, 'error', v_error_message);
  END;

  -- ── Success: record the audit row and return the full report ────────
  v_execution_time_ms := CEIL(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000);

  INSERT INTO public.admin_audit_log (
    action, performed_by, old_user_id, new_user_id, dry_run, result,
    caller_email, caller_name, ip_address, user_agent, execution_time_ms, total_rows,
    old_user_email, old_user_name, new_user_email, new_user_name,
    details, warnings, created_at
  ) VALUES (
    'admin_account_migration', p_caller_id, p_old_user_id, p_new_user_id, false, 'success',
    p_caller_email, p_caller_name, p_ip_address, p_user_agent, v_execution_time_ms, v_total_rows,
    p_old_user_email, p_old_user_name, p_new_user_email, p_new_user_name,
    jsonb_build_object(
      'reassignTables', v_reassign_report,
      'relationshipTables', v_relationship_report,
      'senderTables', v_sender_report,
      'wallet', v_wallet_report
    ),
    '[]'::jsonb, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'oldUserId', p_old_user_id,
    'newUserId', p_new_user_id,
    'totalRows', v_total_rows,
    'report', jsonb_build_object(
      'reassignTables', v_reassign_report,
      'relationshipTables', v_relationship_report,
      'senderTables', v_sender_report,
      'wallet', v_wallet_report
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_migrate_account(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_migrate_account(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_migrate_account(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text
) TO service_role;

-- ════════════════════════════════════════════════════════════════════════
-- End of file.
-- ════════════════════════════════════════════════════════════════════════
