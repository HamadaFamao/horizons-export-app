# Famo — Account Migration Schema Inventory

**Purpose:** Ground-truth inventory of every table, view, storage bucket, and user-data
reference in the Famo Supabase project, built *before* writing any account-migration
logic. No migration code is included here — classification and reasoning only.

**Date:** 2026-08-24

## 0. Methodology & a critical caveat

This repository **does not contain the database schema**. There is no
`supabase/migrations/` folder, no schema dump, and no `database/`, `sql/`, or `scripts/`
directory. The only SQL that exists in-repo is:

- 10 loose, ad-hoc `SUPABASE_*.sql` files at the project root (ALTER TABLE patches and a
  handful of `CREATE OR REPLACE FUNCTION` bodies for the Ludo/Race mini-games)
- `SUPABASE_BUCKETS.md` (manual storage-bucket setup instructions)
- Two Supabase Edge Functions under `supabase/functions/` (`admin-account-migration`,
  `quick-worker`)

Everything else — every table name, every column, every relationship — had to be
**reverse-engineered from actual `supabase.from(...)`, `supabase.storage.from(...)`, and
`supabase.rpc(...)` call sites in `src/**`**. This is the same approach the existing
`admin-account-migration` function's own header comment describes ("confirmed against
actual query sites in this codebase"), and it has the same limitation: **anything that
happens only inside a server-side Postgres function (`SECURITY DEFINER` RPC) or only
inside an RLS policy is invisible to this inventory unless that function's body happens
to also live in one of the root `.sql` files.**

Roughly **95 distinct `supabase.rpc()` function names** are called from the client (full
list in §5). Only 6 of those function bodies actually exist in this repo (the Ludo/Race
patch files). The other ~89 — including every agency, gift, withdrawal, recharge, and
mic/PK-battle function — are opaque from here. **Any migration plan must pull the real
`pg_get_functiondef()` of every RPC that touches `oldUserId`/`newUserId`-shaped data
directly from the live database before trusting the "safe to migrate" calls below.**

No `information_schema` output, no constraint list, and no trigger list beyond the one
covered in `SUPABASE_FIX_CHECK_ACTIVE_ROOM_TRIGGER.sql` was available. Every "FK" in §4 is
an **inferred** relationship (same column name / value used to join two tables in
application code), never a confirmed `REFERENCES` constraint. Treat this document as a
map for planning, not as authoritative DDL.

---

## 1. Identity model

| Column | Table | Meaning |
|---|---|---|
| `profiles.id` | `profiles` | Primary key = Supabase Auth `auth.users.id` (UUID). **This is "the" user id** that `admin-account-migration`'s `oldUserId`/`newUserId` refers to. |
| `profiles.profile_id` | `profiles` | A separate, human-facing **numeric** ID (≥ 10000), independently editable by admins via the `admin_update_profile_id_rpc` / `admin_check_profile_id` RPCs (see `src/pages/admin/ProfileIdTool.jsx`). Used for search, agency-invite lookup, and display (`#12345`). **Not a stand-in for the UUID and must never be treated as one.** |
| `auth.users.id` | Supabase Auth (not in `public` schema, not queried directly anywhere in `src/**`) | The actual auth identity. `profiles.id` is assumed to equal this 1:1 (standard Supabase pattern), but no trigger creating `profiles` rows on signup was found in-repo to confirm it. |

`profiles` also carries several **denormalized pointers that a migration must not
ignore**:
- `profiles.agency_id`, `profiles.agency_name` — cached agency membership, duplicating what `agency_memberships` already tracks normalized.
- `profiles.family_id`, `profiles.family_name` — same pattern, purpose unconfirmed (no other read site found).
- `profiles.referral_code` — the account's own referral code (used by `agency_referral_earnings`).
- `profiles.staff_role`, `profiles.isadmin`, `profiles.admin_role` — authorization flags.

Because the existing `admin-account-migration` function **never touches `profiles`
itself** (it only verifies both ids exist), none of these denormalized fields move
automatically — see §3.

---

## 2. Storage buckets (not database tables)

These are Supabase Storage buckets, found via `supabase.storage.from(...)`. Files in them
are addressed by **path convention** (e.g. `${roomId}/avatar.png`, `${userId}/...`), not
by a `user_id` column, so **no SQL `UPDATE` can "migrate" bucket ownership** — moving a
user's files means copying objects to new paths and rewriting the URL columns that
reference them (`profiles.avatar_url`, `photos.url`, `live_rooms.avatar_url`, etc.).

| Bucket | Documented in `SUPABASE_BUCKETS.md`? | Used for | Migration note |
|---|---|---|---|
| `profile-photos` | Yes | User avatar + gallery photos, voice messages (`ChatPage.jsx` uploads voice notes here too, oddly) | User-owned; path likely keyed by user id — verify convention per call site before any copy. |
| `room_avatars` | Yes | Live-room avatar images | Room-owned, not user-owned — out of scope for a user account migration. |
| `room_backgrounds` | Yes | Live-room background images | Room-owned — out of scope. |
| `agency_attachments` | **No** — undocumented | Agency chat file attachments (`AgencyChatSection.jsx`) | Found only via a hardcoded `const bucket = "agency_attachments"` in two call sites. Not in `SUPABASE_BUCKETS.md` at all — flag for manual confirmation it exists/has the right policies. |
| `Gifts` | **No** — undocumented | Admin-uploaded gift icon/image assets (`AdminGiftsPage.jsx`) | Admin/catalog-owned, not user-owned. Capitalized name is inconsistent with every other bucket (all lowercase-with-underscore) — worth flagging as schema drift. |

`room_avatars` and `room_backgrounds` are **also referenced via `supabase.storage.from()`
in LiveRoomPage.jsx with the same literal names** — confirmed these are buckets, not
tables (no `.select()`/`.eq()` column access anywhere, only `.upload()`/`.getPublicUrl()`/`.list()`).

---

## 3. Table inventory & classification

Legend:
- 🟢 **Safe to migrate** — plain `UPDATE ... SET user_col = newUserId WHERE user_col = oldUserId`, no known uniqueness/live-state hazard.
- 🟡 **Merge required** — a uniqueness constraint or two-sided relationship means a blind `UPDATE` can collide or duplicate; needs the same "read both, combine, delete old" pattern the existing function already uses for `wallets`.
- 🔴 **Manual review required** — financial, moderation/trust-and-safety, live/in-progress state, or authority-bearing data where a wrong automatic decision has real consequences (money, bans, active game desync).
- ⚪ **Ignore** — no user-ownership column, or it's a view/config/catalog table that reflects other tables rather than owning data itself.

### 🟢 Safe to migrate

| Table | User column | Why it's safe |
|---|---|---|
| `photos` | `user_id` | Simple ownership, no uniqueness constraint expected (a user has many photos). **Caveat:** `photos` *also* stores `profile_id` (the old user's public numeric id, inserted alongside `user_id` — see `AdminUsers.jsx:534`). A migration that reassigns only `user_id` leaves `profile_id` pointing at the old account's public id. Either also rewrite `profile_id` on migrated rows, or confirm it's unused for anything beyond display. |
| `reward_history` | `user_id` | Append-only ledger of daily-reward claims, no uniqueness constraint apparent. |
| `unread_messages` | `user_id` | Per-user unread counters/state, keyed by `user_id` (+ likely `thread_id`); no cross-user collision risk found. |
| `live_room_follows` | `user_id` | Follow relationship *to a room*, not to another user — plain ownership. |
| `global_messages` | `user_id` | Ephemeral room-wide announcement log (paid global chat messages), no downstream constraint found. |
| `room_songs` | `uploaded_by` (**not** `user_id` — different column name; not currently in the existing edge function's `REASSIGN_TABLES` at all — gap) | Playlist attribution only; low stakes. |
| `messages` | `sender_id` | Already handled as `SENDER_TABLES` in the existing function. Safe **only** if migrated in the same transaction/run as `threads` (see Relationship tables below) — a message whose `sender_id` was moved but whose `thread.user_a`/`user_b` wasn't would no longer belong to either side of its own thread. |

### 🟡 Merge required (uniqueness / two-sided collision risk)

| Table | Columns | Why merge, not blind reassign |
|---|---|---|
| `wallets` | `user_id` (unique per user) | **Already handled correctly** by `migrateWallet()` in the existing function — one row per user, balances summed, old row deleted. Included here for completeness. |
| `blocks` | `blocker`, `blocked` | Two-sided relationship. **Already handled correctly** via `RELATIONSHIP_TABLES` + `cleanupSelfPairs`. |
| `threads` | `user_a`, `user_b` | Same pattern, **already handled correctly**. |
| `matches` | `user_a`, `user_b` | Same pattern, **already handled correctly**. |
| `sent_gifts` | `sender_id`, `receiver_id` | **Not currently in the existing function at all** — this is a gap. Same two-sided shape as `blocks`/`threads`/`matches` (a user could have both sent gifts to, and received gifts from, the other account being merged), so it needs the identical reassign-both-sides + self-pair-cleanup treatment, not a plain single-column `UPDATE`. |
| `agency_memberships` | `agency_id`, `user_id` (+ `role`, `joined_at`, `left_at`) | Currently in `REASSIGN_TABLES` as a plain bulk reassign, but if `newUserId` already has an **active** membership (`left_at IS NULL`) in the same agency that `oldUserId` also actively belongs to, a blind reassign produces two active-membership rows for the same `(agency_id, user_id)` pair. Needs a check-then-merge, not a blind `UPDATE`. |
| `agency_referral_earnings` | `agent_user_id`, `referred_user_id` | Two-sided (an account can be both an agent earning commission *and* someone else's referred user). Also financial — see 🔴 below; listed here because the two-sided shape alone requires merge-style handling before it can even be a candidate for automation. |

### 🔴 Manual review required

| Table / concern | Columns | Why it needs a human, not a script |
|---|---|---|
| `user_bans` | `user_id`, `banned_by`, `is_active` | Platform-wide account ban record (checked in `AuthContext.jsx` / `ProtectedRoute.jsx` on every session load). Currently in the existing function's `REASSIGN_TABLES` as a plain bulk reassign — but whether a ban should follow an account into a *different* auth identity is the same moderation-policy call as `live_room_bans` below, not a default-safe data move. |
| `agencies` | `owner_user_id`, `banned_by`, `ban_reason` | Reassigning who owns an entire agency (staff, chat, earnings, payout cycles) is a business decision, not a data-hygiene one. The app already has a dedicated admin flow for this (`AdminAgencies.jsx` "Change Owner") that also fixes up `agency_memberships` roles — a generic migration script duplicating that logic risks getting it wrong. |
| `recharge_agents` | `user_id` | This is a granted operator role (KYC'd recharge agent), not just data. Moving it silently would let a *different* auth account inherit recharge-agent trust without going through whatever vetting granted it originally. |
| `gem_withdrawal_requests` | `user_id`, `cycle_id`, `batch_id`, `status` | Financial request record tied to a specific withdrawal cycle/batch that other rows (`gem_withdrawal_splits`) reference. Reassigning `user_id` after the fact changes who a payout was legally made to/requested by — an audit-trail concern, not a technical one. |
| `recharge_agent_transfers` | `agent_user_id` (confirmed); a paired recipient/customer column likely exists but wasn't confirmed from any `.select()`/`.eq()` call site in `src/**` | Financial transfer ledger. **Not in the existing function's table list at all** (gap). Needs the actual column list pulled from the live DB before any reassignment is even designed. |
| `agency_withdrawal_cycles` | `agency_user_id` | Financial cycle record (`locked_gems`, `locked_usd`, `agent_earned_gems`, `status`) — same audit-trail concern as withdrawal requests. |
| `agency_earnings_snapshots` | `agency_user_id`, `snapshot_json`, `cycle_month` | This is a **point-in-time historical snapshot** of who earned what in a given month. Rewriting its owner after the fact falsifies history rather than migrating data — recommend leaving these attributed to the original account regardless of what else migrates. |
| `reports` | `reporter_id`, `reported_user_id` | Trust & safety record. Same historical-integrity argument as earnings snapshots — moving who filed/was-the-subject-of a report after the fact undermines moderation history. Recommend leaving as-is; if a merge must reflect a *new* identity going forward, that's a policy call for whoever owns moderation, not a default script behavior. |
| `live_room_bans` | `user_id` (banned party), `banned_by` (admin), `revoked_at`, `reason` | Whether a ban should "follow" an account into its new identity is a moderation policy decision (could go either way depending on *why* the migration is happening — e.g. ban-evasion vs. legitimate account merge). Must not be silently reassigned by default. |
| `live_room_mutes` | `muted_by` (admin), presumed muted-user column | Same reasoning as bans. |
| `live_room_roles` | `user_id`, `created_by` (who granted the role) | Reassigning room moderator/co-host authority to a different auth account is an authority-transfer action, not a data move. |
| `live_room_pk_sessions` / `live_room_pk_participants` | `created_by`; participant `user_id` | Live, potentially **in-progress** PK-battle state with real-time broadcast and coin stakes. Migrating mid-battle risks desyncing connected clients and double-counting/losing stakes. |
| `room_ludo_players`, `room_race_players`, `room_spin_players`, `room_trivia_players` | `user_id`, `session_id`, `left_at`, `refunded_at`, plus game-specific state (`piece1..4`, `position`, `score`, …) | Same live-session risk as PK battles — these back real-money entry-fee games with `SECURITY DEFINER` RPCs (`move_ludo_piece`, `roll_race_dice`, etc.) that check turn ownership by `user_id`. Migrating a row for a session that is currently `status = 'playing'` can desync an active game other real players are in. Should only ever be migrated for sessions already `finished`/`cancelled`, and even then, coin payouts already resolved (`winner_coins` paid into `wallets`) make re-attribution mostly cosmetic history. |
| `crack_sessions` | `user_id`, `status` | Same reasoning, smaller blast radius (single-player) — safe once `status != 'active'`, otherwise same live-state risk. |
| `subscriptions` | `user_id`, `plan_id`, `status` | Billing-history table; uniqueness per user was not confirmed (no `.eq('user_id', …).single()` pattern found, only `.insert()`), and reassigning active-subscription ownership has billing implications. |
| `live_room_participants`, `live_room_presence`, `live_room_mic_seats` | `user_id` (nullable on mic seats) | Ephemeral, real-time "who is in this room right now" state, actively read/written by every connected client via realtime subscriptions. A row reassigned mid-session while the old account is still connected will desync that client's own view of itself. Low historical value — recommend excluding entirely rather than migrating, and letting normal join/leave flows repopulate them for the new account. |
| `profiles.agency_id` / `profiles.family_id` / `profiles.referral_code` (fields, not a table) | — | Since `profiles` itself is never touched by the existing migration function, these denormalized pointers on the **old** profile row stay as-is even after `agency_memberships` etc. move. If the app reads `profiles.agency_id` anywhere instead of joining `agency_memberships` live (grep confirms `AgentDashboard.jsx` does exactly this), post-migration state can visibly disagree between the two accounts until someone reconciles it. |

### ⚪ Ignore (no user-ownership column, or reflects other tables)

| Name | Kind | Reasoning |
|---|---|---|
| `countries` | Reference/lookup table | Static list, no user column. |
| `gift_catalog` | Catalog table | Admin-managed gift definitions (`AdminGiftsPage.jsx` CRUD), no per-user rows. |
| `recharge_packages` | Catalog table | Admin/static package definitions. |
| `agency_payout_tiers` | Config table | Global commission-tier thresholds, `is_active`/`min_gems`, no user column. |
| `room_lobby_banners` | Admin content table | Promotional banners for the rooms lobby, no user column. |
| `room_trivia_questions` | Content table | Scoped to `session_id`, not to a user. |
| `admin_audit_log` | System log | Referenced **only** inside `admin-account-migration/index.ts` itself as a best-effort insert (errors are swallowed) — no other read/write site exists anywhere in `src/**`. Its existence in the live database is **unconfirmed**; treat as "may not exist yet" rather than a real table to classify. |
| `v_user_profile_with_wallet` | View | Joins `profiles` + `wallets` for display; migrating the base tables updates this automatically. |
| `v_staff_users` | View | Backs the admin-permission check (`can_manage_users`). Base table unknown/unconfirmed — no direct write site found anywhere. |
| `v_users_admin` | View | Admin user-list projection. |
| `v_user_agency` | View | Per-user agency-membership projection. |
| `v_room_top_senders_alltime` | View | Gift-leaderboard aggregate. |
| `v_live_room_gift_events_full` | View | Live-room gift event feed projection. |
| `v_live_room_mic_requests` | View | Pending mic-request projection. |
| `v_profiles_discover` | View | Discovery-feed projection over `profiles`. |
| `v_agencies_with_members_count` | View | Agency list with aggregated member counts. |
| `v_active_gift_catalog` | View | Filtered/active subset of `gift_catalog`. |

None of these views were observed being written to directly (`.insert()`/`.update()`/`.delete()`)
anywhere in `src/**` — all access is `.select()`. Standard Postgres views with no
`INSTEAD OF` trigger (unconfirmed either way, since trigger definitions aren't in-repo)
update automatically once their base tables change, so they need no migration action of
their own — but they're also not proof of what their base tables actually are; several
(`v_staff_users` in particular) back business logic (admin permission) whose real table
was never found.

---

## 4. Inferred relationships (not confirmed FK constraints)

No `REFERENCES` clause or `information_schema.table_constraints` output exists anywhere
in this repo. Everything below is inferred purely from application code joining two
tables on a shared id value:

| From | Column | Assumed points to |
|---|---|---|
| `photos.user_id`, `wallets.user_id`, `reward_history.user_id`, `unread_messages.user_id`, `user_bans.user_id`, `live_room_*.user_id`, `room_*_players.user_id`, `subscriptions.user_id`, `crack_sessions.user_id`, `recharge_agents.user_id`, `agency_memberships.user_id`, `gem_withdrawal_requests.user_id`, etc. | `user_id` | `profiles.id` (→ `auth.users.id`) |
| `messages.sender_id`, `sent_gifts.sender_id`, `reports.reporter_id`, `agency_referral_earnings.agent_user_id` | `*_id` | `profiles.id` |
| `sent_gifts.receiver_id`, `reports.reported_user_id`, `agency_referral_earnings.referred_user_id` | `*_id` | `profiles.id` |
| `blocks.blocker` / `blocks.blocked`, `threads.user_a` / `user_b`, `matches.user_a` / `user_b` | — | `profiles.id` (both sides) |
| `photos.profile_id`, `agencies.owner.profile_id` (joined via `.select('owner:profiles(profile_id)')`-style patterns) | `profile_id` | `profiles.profile_id` (the **public numeric id**, not the UUID) — a second, independent join path that a UUID-based migration will not automatically fix. |
| `agency_memberships.agency_id`, `agency_withdrawal_cycles`/`agency_earnings_snapshots` (via `agency_user_id`, which despite the name appears to key off the owning user, not an `agencies.id`) | — | `agencies.id` / `agencies.owner_user_id` |
| `room_*_players.session_id` | `session_id` | `room_ludo_sessions.id` / `room_race_sessions.id` / `room_spin_sessions.id` / `room_trivia_sessions.id` respectively |
| `live_room_*.room_id` | `room_id` | `live_rooms.id` |
| `gem_withdrawal_splits.batch_id` | `batch_id` | `gem_withdrawal_requests.batch_id` (not `.id` — a batch groups multiple requests) |

---

## 5. RPC / SECURITY DEFINER function surface

The client calls **~95 distinct Postgres functions** via `supabase.rpc(...)`. These are
where most real writes to financial and game tables actually happen — not through direct
`.insert()`/`.update()` calls. Grouped by domain (function bodies not visible in this
repo except where noted):

- **Agency management**: `request_to_join_agency`, `submit_agency_join_request`, `list_my_own_agency_requests`, `list_my_agency_invites`, `cancel_agency_join_request`, `accept_agency_invite`, `reject_agency_invite`, `leave_agency`, `leave_agency_v2`, `agent_remove_member_from_agency`, `remove_agency_member`, `decide_agency_join_request`, `decide_agency_join_request_bool`, `list_active_agencies`, `get_my_agency_status`, `list_my_agency_join_requests`, `get_or_create_agency_chat_by_agency_id`, `get_my_owned_agency`, `get_agent_dashboard_summary`, `list_agency_members_for_dashboard`, `list_agency_join_requests_for_dashboard`, `list_agency_invites_for_dashboard`, `send_agency_invite_by_profile_id`, `revoke_agency_invite`, `get_my_agent`, `open_agency_cycle_for`, `register_agency_referral`
- **Agency chat**: `get_my_agency_chat_id`, `get_or_create_agency_chat`, `is_agency_chat_admin_or_owner`, `delete_agency_message`, `get_or_create_my_agency_chat`
- **Withdrawals / recharge**: `get_active_recharge_agents_for_user`, `create_gem_withdrawal_request`, `get_withdrawable_gems`, `agent_open_withdrawal_cycle`, `admin_open_withdrawal_cycle`, `admin_search_agencies`, `get_recharge_agent_balance_for_current_user`, `get_profile_preview_by_profile_id`, `recharge_agent_send_coins`, `purchase_recharge_package`, `get_recharge_agent_assigned_splits`, `recharge_agent_submit_split_proof`, `admin_list_gem_withdrawal_requests`, `admin_list_pending_agent_splits`, `admin_finalize_recharge_agent_batch`, `admin_get_withdrawal_request_details`, `admin_get_withdrawal_proof_signed_url`, `admin_reset_gem_withdrawal_request`, `admin_update_gem_withdrawal_status`, `admin_approve_cycle_withdrawal`, `get_agent_client_earnings`, `get_agent_gem_totals`, `get_current_agency_cycle`, `get_agency_members_breakdown`, `get_agency_members_public`
- **Gifts**: `send_live_room_gift`, `frontend_send_live_room_gift`, `send_gift_secure`, `set_vip_status`, `get_user_bag`, `use_bag_gift`, `play_slot_spin`
- **Live room / mic / PK**: `remove_user_from_mic`, `release_stale_live_room_mic_seats`, `frontend_accept_mic_invite`, `frontend_reject_mic_invite`, `join_live_room`, `leave_live_room`, `send_live_room_message`, `set_live_room_mic_mode`, `set_mic_seat_locked`, `move_mic_seat`, `request_live_room_mic`, `leave_mic_seat`, `take_mic_seat_mod_or_owner`, `send_mic_invite`, `approve_mic_request`, `frontend_reject_live_room_mic_request`, `reset_live_room_gift_counters`, `clear_live_room_messages`, `start_live_room_pk_session`, `cancel_live_room_pk_session`, `finish_live_room_pk_session`, `get_server_time_ms`
- **Games**: `join_trivia_team`, `join_trivia_session`, `leave_trivia_session`, `finish_trivia_session`, `submit_trivia_answer`, `finish_spin_session`, `cancel_spin_session`, `join_spin_session`, `leave_spin_session`, `resign_race_game`, `join_race_session`, `leave_race_session`, `cancel_race_session`, `roll_race_dice` *(body in repo — `SUPABASE_ROLL_RACE_DICE.sql`)*, `start_crack_session`, `crack_egg`, `get_ludo_roll`, `move_ludo_piece`, `finish_ludo_team_game` *(body in repo — `SUPABASE_LUDO_RESIGN.sql`)*, `join_ludo_session`, `leave_ludo_session`, `cancel_ludo_session`, `resign_ludo_game` *(body in repo)*
- **Rewards / profile admin**: `claim_daily_reward`, `add_reward_points`, `get_wallet_activity`, `convert_gems_to_coins`, `simulate_online_activity`, `update_user_staff_role`, `admin_check_profile_id`, `admin_update_profile_id_rpc`
- **Misc**: `search_profiles_rpc`, `get_user_threads_with_details`

**Implication for migration:** any of these functions could read or write
`oldUserId`/`newUserId`-shaped rows using logic that never appears in `src/**` (e.g. an
RPC might look up a user by `profile_id` internally, or maintain a table not referenced
anywhere on the client). Before running a real migration, each function whose name
suggests it touches wallet, agency-ownership, or withdrawal state should have its actual
definition pulled from the live database (`pg_get_functiondef`) and reviewed — the same
technique the root `SUPABASE_LUDO_*.sql` patch files already use on themselves.

---

## 6. Triggers

Only one trigger is visible anywhere in this repo:

| Trigger | Table | Timing | Purpose (inferred) |
|---|---|---|---|
| `check_active_room` | `public.live_rooms` | `BEFORE INSERT` (per `SUPABASE_FIX_CHECK_ACTIVE_ROOM_TRIGGER.sql`, which exists specifically to *fix* it to only fire on INSERT, not UPDATE) | Enforces "one active room per owner" — consistent with `CreateRoomModal.jsx`'s explicit pre-check query (`live_rooms` `.eq('owner_user_id', ...)` `.eq('is_active', true)`) that throws `"You already have an active room"` before insert. |

No other trigger definitions exist in-repo. If other tables have triggers (e.g. something
maintaining `profiles.agency_id` from `agency_memberships`, or auto-creating a `profiles`
row on `auth.users` insert, or auto-creating a `wallets` row for new users), they are
**invisible from this repository** and must be checked directly against
`information_schema.triggers` on the live database before migration — the same query the
`SUPABASE_FIX_CHECK_ACTIVE_ROOM_TRIGGER.sql` file already runs for `live_rooms`.

---

## 7. Summary counts

| Category | Count |
|---|---|
| 🟢 Safe to migrate | 7 tables |
| 🟡 Merge required | 7 tables |
| 🔴 Manual review required | 17 tables / field groups |
| ⚪ Ignore (no user column / view / catalog) | 8 base tables + 10 views |
| Storage buckets | 5 (2 undocumented) |
| RPC functions called from client | ~95 (only 6 bodies available in-repo) |
| Triggers confirmed | 1 |

**Bottom line:** the existing `admin-account-migration` function currently touches 14
tables total — `REASSIGN_TABLES` (`photos`, `reward_history`, `user_bans`,
`unread_messages`, `live_room_participants`, `live_room_follows`, `agency_memberships`,
`gem_withdrawal_requests`, `recharge_agents`), `RELATIONSHIP_TABLES` (`blocks`, `threads`,
`matches`), `SENDER_TABLES` (`messages`), and `WALLET_TABLE` (`wallets`). Of those 14, this
inventory agrees 5 are handled correctly as bulk-reassign 🟢 (`photos`, `reward_history`,
`unread_messages`, `live_room_follows`, `messages`), agrees 5 are correctly merge-aware 🟡
(`wallets`, `blocks`, `threads`, `matches`, `agency_memberships` — though `agency_memberships`
still needs an active-row collision check the current code doesn't do), and flags 4 as
🔴 needing a policy decision before any automatic reassignment (`user_bans`,
`live_room_participants`, `gem_withdrawal_requests`, `recharge_agents`).

Entirely **missing** from the existing function: `sent_gifts`, `recharge_agent_transfers`,
`agency_withdrawal_cycles`, `agency_earnings_snapshots`, `room_songs`, `global_messages`,
`live_room_presence`, `live_room_mic_seats`, `live_room_bans`, `live_room_mutes`,
`live_room_roles`, `live_room_pk_sessions`, `live_room_pk_participants`,
`room_ludo_players`, `room_race_players`, `room_spin_players`, `room_trivia_players`,
`crack_sessions`, `subscriptions`, `agencies`, `reports`, `agency_referral_earnings`. Most
of these are 🔴-classified here on purpose (financial, moderation, or live-session data) —
but the two 🟢/🟡 candidates among them (`sent_gifts`, `room_songs`) are real gaps worth
adding once the migration logic actually gets written.
