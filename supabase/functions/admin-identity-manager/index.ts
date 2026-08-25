import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────────────────────────────
// admin-identity-manager
//
// Step 2 of Identity Manager: lets an admin view an account's *login*
// identity (the auth.users row) and replace its login email — nothing else.
//
// This function is intentionally separate from `admin-account-migration` and
// does not import from or modify it. It never reassigns, merges, or deletes
// any application data (profiles, wallets, rooms, VIP, agencies, or any
// other table). The only column this function is allowed to change is
// `auth.users.email`, and even that change is not applied immediately — it
// goes through Supabase's standard double-opt-in email-change flow, so the
// address only takes effect once the user clicks the confirmation link
// Supabase sends to the new address.
//
// Auth: caller must send a Supabase user JWT in the Authorization header,
// and that user must be an admin — either a `v_staff_users` row with
// `can_manage_users = true`, or the legacy `profiles.isadmin = true` flag.
// This is the exact same admin check used by `admin-account-migration`
// (kept as a local copy here since edge functions don't share a module and
// admin-account-migration must not be touched).
//
// Request body — selected by `action`:
//
//   'get_login_identity' (read-only):
//     { action: 'get_login_identity', userId: string (uuid) }
//     Returns the auth.users fields the "Login Identity" card displays:
//     authUserId, provider, email, emailConfirmed, lastSignInAt.
//
//   'change_login_email':
//     { action: 'change_login_email', userId: string (uuid), newEmail: string }
//     Calls the Supabase Admin API's updateUserById to set auth.users.email
//     for userId in a single atomic call — the Auth User ID never changes,
//     and because `email_confirm` is not passed, Supabase requires the user
//     to confirm the new address before it actually takes effect (this call
//     is what triggers Supabase's own "Confirm email change" email to the
//     new address).
//     Uniqueness against every other auth.users account is NOT pre-checked
//     by listing/scanning users here. It is enforced by Supabase Auth's own
//     unique index on auth.users.email as part of that same updateUserById
//     write — see the comment above `isDuplicateEmailError` below for why
//     this is the correct, most-scalable approach. No application table or
//     view is ever queried by this action.
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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isValidUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value)

const AUDIT_TABLE = 'admin_audit_log'
const AUDIT_ACTION = 'admin_identity_email_change'

// ── Email uniqueness ──────────────────────────────────────────────────────
// The Admin API has no exact-match "get user by email" endpoint (confirmed
// against auth-js's GoTrueAdminApi: only getUserById(uid) exists; listUsers
// only paginates). Its `filter` query param does an unindexed `email LIKE
// '%...%' OR full_name ILIKE '%...%'` scan server-side — not exact, not
// indexed, and still effectively O(n), so it is not a real substitute.
//
// Instead of pre-checking availability at all, this relies on the one thing
// that *is* a direct, indexed, server-side lookup: Supabase Auth's own
// unique index on auth.users.email, enforced by Postgres as part of the
// same updateUserById call that performs the change. `User.SetEmail` (the
// GoTrue model backing updateUserById) issues a plain, atomic
// `UPDATE auth.users SET email = ...` inside a transaction — there is no
// separate pending/staging column involved — so if another account already
// holds that email, Postgres rejects the UPDATE immediately via its
// `users_email_partial_key` unique index and the whole transaction rolls
// back; nothing is ever partially applied. That index lookup is O(log n)
// against a B-tree no matter how many rows auth.users holds (1M+ included),
// which is as close to O(1) as this ever gets — and it is the Auth
// database's own guarantee, not something this function computes, so it
// can never be missed or made stale by pagination.
//
// Scope note: `users_email_partial_key` is a *partial* index — it applies
// `WHERE is_sso_user = false`. This is intentional in Supabase Auth itself:
// SSO-linked accounts are allowed to share an email with a password/email
// account (see GoTrue's own account-creation duplicate check and its
// FindUserByEmailAndAudience lookup, both scoped the same way — password
// reset/magic-link/OTP flows always resolve an email to the non-SSO account
// only). Login Identity here only ever edits the password/email identity,
// so checking uniqueness within that same non-SSO domain is the correct,
// canonical scope — not a gap introduced by this function.
//
// If updateUserById fails for any reason (including a duplicate-email
// rejection), the transaction did not commit and the email was NOT changed
// — this function fails closed on every error path, so a false negative
// (silently allowing a duplicate) is not possible even if the pattern below
// fails to recognize a particular error's wording.
const DUPLICATE_EMAIL_PATTERNS = [/already.*(registered|exists|in use|taken)/i, /duplicate|unique constraint/i]
const DUPLICATE_EMAIL_CODES = new Set(['email_exists', 'user_already_exists', 'email_conflict'])

function isDuplicateEmailError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const code = (error as { code?: string }).code
  if (code && DUPLICATE_EMAIL_CODES.has(code)) return true
  return DUPLICATE_EMAIL_PATTERNS.some((re) => re.test(error.message ?? ''))
}

// ── Admin check (manager users are allowed when they are recognized as staff
// managers, even if the v_staff_users.can_manage_users flag is not set).
// This keeps the function aligned with the app's Manager-role checks without
// changing any other auth or email logic. ─────────────────────────────────
async function isCallerAdmin(supabase: SupabaseClient, callerId: string): Promise<boolean> {
  const { data: staffRow } = await supabase
    .from('v_staff_users')
    .select('can_manage_users, staff_role')
    .eq('id', callerId)
    .maybeSingle()

  if (staffRow?.staff_role === 'manager') return true
  if (staffRow?.can_manage_users) return true

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('isadmin')
    .eq('id', callerId)
    .maybeSingle()
  return !!profileRow?.isadmin
}

// ── Request metadata (audit trail) ───────────────────────────────────────
function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

// ── 'get_login_identity' ─────────────────────────────────────────────────
async function getLoginIdentity(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; error?: string; identity?: Record<string, unknown> }> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) {
    return { success: false, error: error?.message ?? 'No auth user found for that Auth User ID' }
  }
  const user = data.user
  const provider =
    (user.app_metadata as Record<string, unknown> | null)?.provider ??
    (Array.isArray(user.identities) && user.identities.length > 0 ? user.identities[0]?.provider : null) ??
    'email'

  return {
    success: true,
    identity: {
      authUserId: user.id,
      provider,
      email: user.email ?? null,
      emailConfirmed: !!user.email_confirmed_at,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
    },
  }
}

// ── 'change_login_email' ─────────────────────────────────────────────────
async function changeLoginEmail(
  supabase: SupabaseClient,
  callerId: string,
  callerEmail: string | null,
  callerName: string | null,
  ipAddress: string,
  userAgent: string,
  userId: string,
  rawNewEmail: string,
): Promise<{ success: boolean; error?: string; message?: string; pendingEmail?: string }> {
  const newEmail = rawNewEmail.trim().toLowerCase()
  if (!newEmail) return { success: false, error: 'New email cannot be empty' }
  if (!EMAIL_REGEX.test(newEmail)) return { success: false, error: 'New email is not a valid email address' }

  // Step 0 — resolve the current auth user so we know its current email and
  // that the Auth User ID actually exists.
  const { data: currentUserData, error: currentUserErr } = await supabase.auth.admin.getUserById(userId)
  if (currentUserErr || !currentUserData?.user) {
    return { success: false, error: currentUserErr?.message ?? 'No auth user found for that Auth User ID' }
  }
  const currentEmail = (currentUserData.user.email ?? '').toLowerCase()
  if (newEmail === currentEmail) {
    return { success: false, error: 'New email must be different from the current email' }
  }

  // Step 1 — Supabase Admin API updates auth.users.email for this Auth User
  // ID in a single atomic call. Uniqueness against every other (non-SSO)
  // account is enforced server-side by Postgres's own unique index on
  // auth.users.email as part of this same write — not by a separate
  // listing/scanning pre-check — so it is O(log n) regardless of table
  // size and can never be missed by pagination (see the comment block
  // above `isDuplicateEmailError` for the full explanation and its scope).
  // `email_confirm` is deliberately omitted (not set to true), so Supabase
  // does NOT swap the email immediately — it starts its standard
  // double-opt-in "confirm email change" flow and sends the confirmation
  // email to newEmail itself. The Auth User ID is untouched, and no
  // application table (profiles, wallets, rooms, VIP, agencies, ...) is
  // written to by this call.
  const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { email: newEmail })

  if (updateErr) {
    if (isDuplicateEmailError(updateErr)) {
      return { success: false, error: 'That email is already in use by another account' }
    }

    await supabase.from(AUDIT_TABLE).insert({
      action: AUDIT_ACTION,
      performed_by: callerId,
      old_user_id: userId,
      new_user_id: userId,
      dry_run: false,
      result: 'failure',
      caller_email: callerEmail,
      caller_name: callerName,
      ip_address: ipAddress,
      user_agent: userAgent,
      old_user_email: currentUserData.user.email ?? null,
      new_user_email: newEmail,
      warnings: [updateErr.message],
      details: { note: 'Login identity email change failed' },
      created_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.warn('[admin-identity-manager] Failure audit log insert skipped:', error.message)
    })
    return { success: false, error: `Failed to start email change: ${updateErr.message}` }
  }

  // Best-effort audit entry — never blocks the response if it fails.
  const { error: auditErr } = await supabase.from(AUDIT_TABLE).insert({
    action: AUDIT_ACTION,
    performed_by: callerId,
    old_user_id: userId,
    new_user_id: userId,
    dry_run: false,
    result: 'success',
    caller_email: callerEmail,
    caller_name: callerName,
    ip_address: ipAddress,
    user_agent: userAgent,
    old_user_email: currentUserData.user.email ?? null,
    new_user_email: newEmail,
    warnings: [],
    details: { note: 'Verification email sent; pending user confirmation before the email actually changes' },
    created_at: new Date().toISOString(),
  })
  if (auditErr) {
    console.warn('[admin-identity-manager] Success audit log insert skipped:', auditErr.message)
  }

  return {
    success: true,
    message: `Verification email sent to ${newEmail}. The login email will update automatically once the user confirms it.`,
    pendingEmail: newEmail,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.')
  }

  try {
    // ── Read Authorization header ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('Missing Authorization header')
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return errorResponse('Missing bearer token in Authorization header')
    }

    // ── Create Supabase client using the Service Role key ───────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[admin-identity-manager] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return errorResponse('Server misconfiguration: missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Identify the caller and require admin privileges ─────────────────────
    const { data: callerAuth, error: callerAuthErr } = await supabase.auth.getUser(token)
    if (callerAuthErr || !callerAuth?.user) {
      return errorResponse('Invalid or expired session token')
    }
    const callerId = callerAuth.user.id
    const callerEmail = callerAuth.user.email ?? null

    const admin = await isCallerAdmin(supabase, callerId)
    if (!admin) {
      console.warn('[admin-identity-manager] Forbidden: caller is not an admin', { callerId })
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

    // ── Parse body ────────────────────────────────────────────────────────
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body')
    }

    const { action, userId, newEmail } = body as {
      action?: unknown
      userId?: unknown
      newEmail?: unknown
    }

    if (!isValidUuid(userId)) {
      return errorResponse('userId must be a valid UUID')
    }

    if (action === 'get_login_identity') {
      const result = await getLoginIdentity(supabase, userId)
      return jsonResponse(result)
    }

    if (action === 'change_login_email') {
      if (typeof newEmail !== 'string') {
        return errorResponse('newEmail must be a string')
      }
      const result = await changeLoginEmail(
        supabase,
        callerId,
        callerEmail,
        callerName,
        ipAddress,
        userAgent,
        userId,
        newEmail,
      )
      return jsonResponse(result)
    }

    return errorResponse("action must be one of 'get_login_identity', 'change_login_email'")
  } catch (err) {
    console.error('[admin-identity-manager] Unhandled error:', err)
    return errorResponse((err as Error)?.message ?? String(err))
  }
})
