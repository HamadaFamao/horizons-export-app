import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────────────────────────────
// admin-account-migration
//
// Reassigns all app data owned by `oldUserId` to `newUserId`. Intended for
// admin-triggered account merges (e.g. a player re-registers under a new
// auth account and support wants their history moved over).
//
// Auth: caller must send a Supabase user JWT in the Authorization header,
// and that user must be an admin — either a `v_staff_users` row with
// `can_manage_users = true`, or the legacy `profiles.isadmin = true` flag
// (same fallback order used by AdminPermissionsContext on the client).
//
// Request body — selected by `action`:
//
//   'lookup' (read-only, used by the Account Migration search panels AND the
//   Identity Manager account lookup panel — one shared implementation so
//   neither page duplicates the account-resolution logic):
//     { action: 'lookup', searchBy: 'email' | 'profile_id' | 'user_id', query: string }
//     Returns everything the Account Migration panels display (avatar, name,
//     email, ids, plan, agency, wallet, ban/migration status) plus the extra
//     read-only identity fields the Identity Manager page displays
//     (adminRole, staffRole, isAdmin, and the account's live room if it owns
//     one) — Account Migration simply ignores the fields it doesn't use.
//
//   'migration_status' (read-only, rollback protection):
//     { action: 'migration_status', oldUserId: string (uuid) }
//
//   'migrate' (default when `action` is omitted, for backward compatibility):
//     { oldUserId: string (uuid), newUserId: string (uuid), dryRun: boolean }
//     `dryRun: true` only counts affected rows per table — it makes no writes.
//     `dryRun: false` performs the migration inside a single Postgres
//     transaction (see admin_migrate_account() in
//     SUPABASE_ACCOUNT_MIGRATION_HARDENING.sql) — if any table fails, every
//     write since the start of the migration is rolled back automatically.
//
//   'history' (read-only, Migration History admin page):
//     { action: 'history', search?: string, page?: number, pageSize?: number }
// ────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Always return 200 so the Supabase client puts the body in `data` (not `error`)
// The caller checks data?.success to detect failures
const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const errorResponse = (error: string) => jsonResponse({ success: false, error })

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isValidUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value)

// ── Table configuration ──────────────────────────────────────────────────
// Every table/column below was confirmed against actual query sites in this
// codebase (src/**) before being included here. Tables whose user-id column
// or uniqueness constraints could not be confirmed are deliberately left
// out — add them only after verifying the schema, since a wrong column name
// silently reassigns the wrong data and a wrong uniqueness assumption can
// throw mid-migration.
//
// This exact table/column set is mirrored in admin_migrate_account() (SQL)
// for the real (non-dry-run) write path — keep the two in sync.

// Tables where a user can own many rows, so bulk-reassigning the owner
// column is safe (no unique(column) constraint expected).
const REASSIGN_TABLES: Array<{ table: string; column: string }> = [
  { table: 'photos', column: 'user_id' },
  { table: 'reward_history', column: 'user_id' },
  { table: 'user_bans', column: 'user_id' },
  { table: 'unread_messages', column: 'user_id' },
  { table: 'live_room_participants', column: 'user_id' },
  { table: 'live_room_follows', column: 'user_id' },
  { table: 'agency_memberships', column: 'user_id' },
  { table: 'gem_withdrawal_requests', column: 'user_id' },
  { table: 'recharge_agents', column: 'user_id' },
]

// Tables that model a relationship between two users. Both sides are
// migrated, then any row left pointing at itself (a byproduct of the
// migration, e.g. old and new had a row with each other) is removed.
const RELATIONSHIP_TABLES: Array<{ table: string; columns: [string, string] }> = [
  { table: 'blocks', columns: ['blocker', 'blocked'] },
  { table: 'threads', columns: ['user_a', 'user_b'] },
  { table: 'matches', columns: ['user_a', 'user_b'] },
]

// Tables where the user id marks authorship rather than ownership.
const SENDER_TABLES: Array<{ table: string; column: string }> = [
  { table: 'messages', column: 'sender_id' },
]

// `wallets` has one row per user (unique user_id), so it cannot be handled
// by a blanket UPDATE — moving the row would collide with newUserId's own
// wallet. Balances are merged instead (see migrateWallet()).
const WALLET_TABLE = 'wallets'

const AUDIT_TABLE = 'admin_audit_log'
const AUDIT_ACTION = 'admin_account_migration'

type CountResult = { table: string; column: string; matched: number; error?: string }

async function countMatches(
  supabase: SupabaseClient,
  table: string,
  column: string,
  userId: string,
): Promise<CountResult> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, userId)
    if (error) return { table, column, matched: 0, error: error.message }
    return { table, column, matched: count ?? 0 }
  } catch (err) {
    return { table, column, matched: 0, error: (err as Error)?.message ?? String(err) }
  }
}

async function isCallerAdmin(supabase: SupabaseClient, callerId: string): Promise<boolean> {
  const { data: staffRow } = await supabase
    .from('v_staff_users')
    .select('can_manage_users')
    .eq('id', callerId)
    .maybeSingle()
  if (staffRow?.can_manage_users) return true

  // Fallback for the legacy admin flag (mirrors AdminPermissionsContext).
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('isadmin')
    .eq('id', callerId)
    .maybeSingle()
  return !!profileRow?.isadmin
}

// ── Account lookup (used by the Admin "Account Migration" page) ────────────
// Resolves an account by email / profile_id / user_id and returns the
// display fields the migration UI needs (avatar, name, email, ids, plan,
// agency, wallet, ban status). Reads only — no writes ever happen here.

type SearchBy = 'email' | 'profile_id' | 'user_id'

const isSearchBy = (value: unknown): value is SearchBy =>
  value === 'email' || value === 'profile_id' || value === 'user_id'

async function getBanStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ isBanned: boolean; isPermanent: boolean; bannedUntil: string | null; reason: string | null }> {
  const { data } = await supabase
    .from('user_bans')
    .select('banned_until, is_active, reason')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) return { isBanned: false, isPermanent: false, bannedUntil: null, reason: null }

  const isPermanent = !data.banned_until
  const isStillBanned = isPermanent || new Date(data.banned_until) > new Date()
  return {
    isBanned: isStillBanned,
    isPermanent: isStillBanned && isPermanent,
    bannedUntil: data.banned_until ?? null,
    reason: data.reason ?? null,
  }
}

// Best-effort: does this user currently own an active ("live") room, and if
// so, its display fields. A missing/inactive room is not an error — most
// accounts don't own one.
async function getOwnedLiveRoom(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('live_rooms')
    .select('id, title, avatar_url, is_active, is_locked, public_room_id')
    .eq('owner_user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    title: data.title ?? null,
    coverUrl: data.avatar_url ?? null,
    isActive: !!data.is_active,
    isLocked: !!data.is_locked,
    publicRoomId: data.public_room_id ?? null,
  }
}

async function lookupAccount(
  supabase: SupabaseClient,
  searchBy: SearchBy,
  rawQuery: string,
): Promise<{ success: boolean; error?: string; account?: Record<string, unknown> }> {
  const query = rawQuery.trim()
  if (!query) return { success: false, error: 'Search query cannot be empty' }

  // Step 1 — resolve the target user_uuid + email via the admin view (this is
  // the same view AdminUsers.jsx already reads, so it's known to expose
  // email alongside profile data).
  let viewQuery = supabase.from('v_users_admin').select('*').limit(1)
  if (searchBy === 'email') {
    viewQuery = viewQuery.ilike('email', query)
  } else if (searchBy === 'profile_id') {
    const numericId = Number.parseInt(query, 10)
    if (!Number.isFinite(numericId)) return { success: false, error: 'Profile ID must be a number' }
    viewQuery = viewQuery.eq('profile_id', numericId)
  } else if (searchBy === 'user_id') {
    if (!isValidUuid(query)) return { success: false, error: 'User ID must be a valid UUID' }
    viewQuery = viewQuery.eq('user_uuid', query)
  } else {
    return { success: false, error: 'Invalid searchBy value' }
  }

  const { data: viewRows, error: viewErr } = await viewQuery
  if (viewErr) return { success: false, error: `Lookup failed: ${viewErr.message}` }
  const viewRow = (viewRows ?? [])[0] as Record<string, unknown> | undefined
  if (!viewRow) return { success: false, error: 'No account found matching that search' }

  const userId = (viewRow.user_uuid ?? viewRow.id) as string | undefined
  if (!isValidUuid(userId)) return { success: false, error: 'Matched account has no valid user id' }

  // Step 2 — canonical profile fields straight from `profiles` (source of
  // truth for avatar/plan; the view is only trusted for search+email).
  // NOTE: `profiles` is not assumed to carry agency_id/agency_name — those
  // are loaded from `v_user_agency` in Step 2b instead (the same view
  // ProfilePage.jsx / MessagesPage.jsx / AgentDashboard.jsx / LiveRoomPage.jsx
  // already treat as the source of truth for agency membership).
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, profile_id, name, avatar_url, is_vip, vip_number, vip_until, isadmin, admin_role, staff_role')
    .eq('id', userId)
    .maybeSingle()
  if (profileErr || !profile) {
    return { success: false, error: profileErr?.message ?? 'Matched account is missing its profile row' }
  }

  // Step 2b — agency membership from `v_user_agency`, keyed by the profile's
  // user id. Best-effort: no matching row just means "no agency", not an error.
  const { data: userAgency } = await supabase
    .from('v_user_agency')
    .select('agency_id, agency_name')
    .eq('user_id', userId)
    .maybeSingle()

  // Step 3 — wallet summary (best-effort; a missing wallet is not an error).
  const { data: wallet } = await supabase
    .from('wallets')
    .select('coins, gems, level, xp')
    .eq('user_id', userId)
    .maybeSingle()

  const ban = await getBanStatus(supabase, userId)
  const migrationStatus = await checkAlreadyMigrated(supabase, userId)
  const room = await getOwnedLiveRoom(supabase, userId)

  return {
    success: true,
    account: {
      id: userId,
      profileId: profile.profile_id ?? viewRow.profile_id ?? null,
      name: profile.name ?? viewRow.name ?? null,
      email: viewRow.email ?? null,
      avatarUrl: profile.avatar_url ?? viewRow.avatar_url ?? null,
      plan: {
        isVip: !!profile.is_vip,
        vipNumber: profile.vip_number ?? null,
        vipUntil: profile.vip_until ?? null,
      },
      agency: {
        agencyId: userAgency?.agency_id ?? null,
        agencyName: userAgency?.agency_name ?? null,
      },
      wallet: wallet ?? null,
      ban,
      alreadyMigrated: migrationStatus.alreadyMigrated,
      migratedTo: migrationStatus.migratedTo ?? null,
      migratedAt: migrationStatus.migratedAt ?? null,
      // Read-only identity fields (used by the Identity Manager page; Account
      // Migration's UI does not read these).
      isAdmin: !!profile.isadmin,
      adminRole: profile.admin_role ?? null,
      staffRole: profile.staff_role ?? null,
      isRoomOwner: !!room,
      room,
    },
  }
}

// ── Rollback protection / idempotency ───────────────────────────────────
// Has `oldUserId` already been the *source* of a successful, non-dry-run
// migration? Reads straight off admin_audit_log with the service-role
// client, so it's authoritative regardless of table RLS.
async function checkAlreadyMigrated(
  supabase: SupabaseClient,
  oldUserId: string,
): Promise<{ alreadyMigrated: boolean; migratedTo?: string; migratedAt?: string }> {
  const { data, error } = await supabase
    .from(AUDIT_TABLE)
    .select('new_user_id, created_at')
    .eq('old_user_id', oldUserId)
    .eq('action', AUDIT_ACTION)
    .eq('dry_run', false)
    .eq('result', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // If the audit table/columns don't exist yet (pre-hardening DB), fail
  // open on the *check* rather than blocking all migrations — the
  // idempotency guard inside admin_migrate_account() is the real backstop.
  if (error || !data) return { alreadyMigrated: false }
  return { alreadyMigrated: true, migratedTo: data.new_user_id, migratedAt: data.created_at }
}

// ── Edge Function Validation (requirement 5) ────────────────────────────
// Runs before both dry-run and real migrations. `profiles` in this schema
// has no `deleted_at`/`is_active` column (confirmed in
// ACCOUNT_MIGRATION_SCHEMA.md) so "profile active" is verified as: the
// profile row exists AND the account is not currently under an active ban
// (temporary or permanent). "Neither account is banned permanently" is
// checked separately so the operator gets a precise reason.
async function validateAccountsForMigration(
  supabase: SupabaseClient,
  oldUserId: string,
  newUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidUuid(oldUserId)) return { ok: false, error: 'oldUserId must be a valid UUID' }
  if (!isValidUuid(newUserId)) return { ok: false, error: 'newUserId must be a valid UUID' }
  if (oldUserId === newUserId) return { ok: false, error: 'oldUserId and newUserId must be different' }

  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .in('id', [oldUserId, newUserId])
  if (profileErr) {
    console.error('[admin-account-migration] Failed to verify profiles:', profileErr)
    return { ok: false, error: 'Failed to verify oldUserId/newUserId against profiles table' }
  }
  const foundIds = new Set((profileRows ?? []).map((r: { id: string }) => r.id))
  if (!foundIds.has(oldUserId)) return { ok: false, error: 'oldUserId does not match any profile' }
  if (!foundIds.has(newUserId)) return { ok: false, error: 'newUserId does not match any profile' }

  const [oldBan, newBan] = await Promise.all([
    getBanStatus(supabase, oldUserId),
    getBanStatus(supabase, newUserId),
  ])

  if (oldBan.isPermanent) return { ok: false, error: 'oldUserId is permanently banned and cannot be migrated' }
  if (newBan.isPermanent) return { ok: false, error: 'newUserId is permanently banned and cannot receive a migration' }
  if (oldBan.isBanned) return { ok: false, error: 'oldUserId profile is not active (currently suspended)' }
  if (newBan.isBanned) return { ok: false, error: 'newUserId profile is not active (currently suspended)' }

  return { ok: true }
}

// ── Request metadata (audit trail) ───────────────────────────────────────
function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── 1. Only allow POST ───────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.')
  }

  try {
    // ── 2. Read Authorization header ───────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('Missing Authorization header')
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return errorResponse('Missing bearer token in Authorization header')
    }

    // ── 3. Create Supabase client using the Service Role key ────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[admin-account-migration] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return errorResponse('Server misconfiguration: missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 4. Identify the caller and require admin privileges ─────────────────
    const { data: callerAuth, error: callerAuthErr } = await supabase.auth.getUser(token)
    if (callerAuthErr || !callerAuth?.user) {
      return errorResponse('Invalid or expired session token')
    }
    const callerId = callerAuth.user.id
    const callerEmail = callerAuth.user.email ?? null

    const admin = await isCallerAdmin(supabase, callerId)
    if (!admin) {
      console.warn('[admin-account-migration] Forbidden: caller is not an admin', { callerId })
      return errorResponse('Forbidden: admin privileges required')
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', callerId)
      .maybeSingle()
    const callerName = callerProfile?.name ?? null
    const ipAddress = getClientIp(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // ── 5. Parse body ─────────────────────────────────────────────────────
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body')
    }

    const { action, oldUserId, newUserId, dryRun, searchBy, query, search, page, pageSize } = body as {
      action?: unknown
      oldUserId?: unknown
      newUserId?: unknown
      dryRun?: unknown
      searchBy?: unknown
      query?: unknown
      search?: unknown
      page?: unknown
      pageSize?: unknown
    }

    // ── 5a. Account lookup (read-only; used by the Account Migration UI) ────
    if (action === 'lookup') {
      if (!isSearchBy(searchBy)) {
        return errorResponse("searchBy must be one of 'email', 'profile_id', 'user_id'")
      }
      if (typeof query !== 'string') {
        return errorResponse('query must be a string')
      }
      const result = await lookupAccount(supabase, searchBy, query)
      return jsonResponse(result)
    }

    // ── 5b. Migration status (read-only; rollback protection) ───────────────
    if (action === 'migration_status') {
      if (!isValidUuid(oldUserId)) return errorResponse('oldUserId must be a valid UUID')
      const status = await checkAlreadyMigrated(supabase, oldUserId)
      return jsonResponse({ success: true, ...status })
    }

    // ── 5c. Migration history (read-only; Migration History admin page) ─────
    if (action === 'history') {
      const pageNum = typeof page === 'number' && Number.isFinite(page) ? Math.max(0, page) : 0
      const size = typeof pageSize === 'number' && Number.isFinite(pageSize) ? Math.min(200, Math.max(1, pageSize)) : 50
      const from = pageNum * size
      const to = from + size - 1

      let historyQuery = supabase
        .from(AUDIT_TABLE)
        .select('*', { count: 'exact' })
        .eq('action', AUDIT_ACTION)
        .order('created_at', { ascending: false })
        .range(from, to)

      const trimmedSearch = typeof search === 'string' ? search.trim() : ''
      if (trimmedSearch) {
        const like = `%${trimmedSearch}%`
        historyQuery = historyQuery.or(
          [
            `old_user_email.ilike.${like}`,
            `old_user_name.ilike.${like}`,
            `new_user_email.ilike.${like}`,
            `new_user_name.ilike.${like}`,
            `caller_email.ilike.${like}`,
            `caller_name.ilike.${like}`,
          ].join(','),
        )
      }

      const { data, error, count } = await historyQuery
      if (error) {
        console.error('[admin-account-migration] History query failed:', error)
        return errorResponse(`Failed to load migration history: ${error.message}`)
      }

      return jsonResponse({ success: true, rows: data ?? [], total: count ?? 0, page: pageNum, pageSize: size })
    }

    // ── 6. Migration (dry run or real) ──────────────────────────────────────
    if (typeof dryRun !== 'boolean') {
      return errorResponse('dryRun must be a boolean')
    }

    // ── 6a. Validate accounts ────────────────────────────────────────────
    const validation = await validateAccountsForMigration(supabase, oldUserId as string, newUserId as string)
    if (!validation.ok) {
      return errorResponse(validation.error)
    }
    const oldUserIdStr = oldUserId as string
    const newUserIdStr = newUserId as string

    console.log('[admin-account-migration] Request validated', { callerId, oldUserId: oldUserIdStr, newUserId: newUserIdStr, dryRun })

    // Denormalized display fields — captured once here so history rows stay
    // readable even if a profile is later renamed or removed.
    const [oldProfile, newProfile] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', oldUserIdStr).maybeSingle(),
      supabase.from('profiles').select('name').eq('id', newUserIdStr).maybeSingle(),
    ])
    const [oldView, newView] = await Promise.all([
      supabase.from('v_users_admin').select('email').eq('user_uuid', oldUserIdStr).maybeSingle(),
      supabase.from('v_users_admin').select('email').eq('user_uuid', newUserIdStr).maybeSingle(),
    ])
    const oldUserName = oldProfile.data?.name ?? null
    const newUserName = newProfile.data?.name ?? null
    const oldUserEmail = oldView.data?.email ?? null
    const newUserEmail = newView.data?.email ?? null

    // ── 6b. Dry run: count affected rows only, no writes ──────────────────
    if (dryRun) {
      const dryRunStart = Date.now()
      const [reassignCounts, senderCounts, walletOld, walletNew] = await Promise.all([
        Promise.all(REASSIGN_TABLES.map((t) => countMatches(supabase, t.table, t.column, oldUserIdStr))),
        Promise.all(SENDER_TABLES.map((t) => countMatches(supabase, t.table, t.column, oldUserIdStr))),
        supabase.from(WALLET_TABLE).select('coins, gems, level, xp').eq('user_id', oldUserIdStr).maybeSingle(),
        supabase.from(WALLET_TABLE).select('coins, gems, level, xp').eq('user_id', newUserIdStr).maybeSingle(),
      ])

      const relationshipCounts = await Promise.all(
        RELATIONSHIP_TABLES.flatMap((t) => [
          countMatches(supabase, t.table, t.columns[0], oldUserIdStr),
          countMatches(supabase, t.table, t.columns[1], oldUserIdStr),
        ]),
      )

      const allCounts = [...reassignCounts, ...senderCounts, ...relationshipCounts]
      const totalRows = allCounts.reduce((sum, r) => sum + (r.matched || 0), 0)
      const warnings = allCounts.filter((r) => r.error).map((r) => `${r.table} (${r.column}): ${r.error}`)

      // Best-effort dry-run audit entry so it shows up in Migration History
      // with Dry Run = true. Never blocks the response if it fails.
      const { error: auditErr } = await supabase.from(AUDIT_TABLE).insert({
        action: AUDIT_ACTION,
        performed_by: callerId,
        old_user_id: oldUserIdStr,
        new_user_id: newUserIdStr,
        dry_run: true,
        result: warnings.length ? 'failure' : 'success',
        caller_email: callerEmail,
        caller_name: callerName,
        ip_address: ipAddress,
        user_agent: userAgent,
        execution_time_ms: Date.now() - dryRunStart,
        total_rows: totalRows,
        old_user_email: oldUserEmail,
        old_user_name: oldUserName,
        new_user_email: newUserEmail,
        new_user_name: newUserName,
        details: {
          reassignTables: reassignCounts,
          relationshipTables: relationshipCounts,
          senderTables: senderCounts,
          wallet: {
            oldWalletExists: !!walletOld.data,
            newWalletExists: !!walletNew.data,
            oldWallet: walletOld.data ?? null,
            newWallet: walletNew.data ?? null,
          },
        },
        warnings,
        created_at: new Date().toISOString(),
      })
      if (auditErr) {
        console.warn('[admin-account-migration] Dry-run audit log insert skipped:', auditErr.message)
      }

      return jsonResponse({
        success: true,
        dryRun: true,
        oldUserId: oldUserIdStr,
        newUserId: newUserIdStr,
        report: {
          reassignTables: reassignCounts,
          relationshipTables: relationshipCounts,
          senderTables: senderCounts,
          wallet: {
            oldWalletExists: !!walletOld.data,
            newWalletExists: !!walletNew.data,
            oldWallet: walletOld.data ?? null,
            newWallet: walletNew.data ?? null,
          },
        },
      })
    }

    // ── 6c. Real migration — delegated to a single Postgres transaction ─────
    // admin_migrate_account() performs every write (wallet merge, reassign
    // tables, relationship tables + cleanup, sender tables) and its own
    // idempotency check, then records the audit row itself, all inside one
    // function call. If any statement throws, everything since the start of
    // the migration is rolled back and a `failure` row is recorded instead —
    // nothing here is left partially migrated. See
    // SUPABASE_ACCOUNT_MIGRATION_HARDENING.sql.
    console.log('[admin-account-migration] Starting migration', { callerId, oldUserId: oldUserIdStr, newUserId: newUserIdStr })

    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_migrate_account', {
      p_old_user_id: oldUserIdStr,
      p_new_user_id: newUserIdStr,
      p_caller_id: callerId,
      p_caller_email: callerEmail,
      p_caller_name: callerName,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_old_user_email: oldUserEmail,
      p_old_user_name: oldUserName,
      p_new_user_email: newUserEmail,
      p_new_user_name: newUserName,
    })

    if (rpcErr) {
      console.error('[admin-account-migration] RPC error:', rpcErr)
      return errorResponse(`Migration failed: ${rpcErr.message}`)
    }
    if (!rpcData?.success) {
      return jsonResponse(rpcData)
    }

    console.log('[admin-account-migration] Migration complete', {
      oldUserId: oldUserIdStr,
      newUserId: newUserIdStr,
      totalRows: rpcData.totalRows,
    })

    return jsonResponse(rpcData)
  } catch (err) {
    console.error('[admin-account-migration] Unhandled error:', err)
    return errorResponse((err as Error)?.message ?? String(err))
  }
})
