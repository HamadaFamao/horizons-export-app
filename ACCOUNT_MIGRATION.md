# Account Migration

Admin-only tooling to merge all app data owned by one account ("old") into
another ("new") — e.g. a player re-registers under a new auth account and
support wants their history, wallet, and relationships carried over.

Related documents:
- [ACCOUNT_MIGRATION_SCHEMA.md](./ACCOUNT_MIGRATION_SCHEMA.md) — the table-by-table
  inventory and safety classification this feature's table scope is built from.
- [SUPABASE_ACCOUNT_MIGRATION_HARDENING.sql](./SUPABASE_ACCOUNT_MIGRATION_HARDENING.sql) —
  the SQL that must be applied to the live database for this feature to work
  (audit log columns + the transactional migration function).

---

## Architecture

```
┌──────────────────────────┐      ┌──────────────────────────────┐      ┌────────────────────┐
│  AccountMigrationPage     │      │  MigrationHistoryPage          │      │  admin_audit_log    │
│  (search, dry run,        │      │  (list, search, export,        │      │  (Postgres table)   │
│   execute, progress)      │      │   details dialog)              │      │                      │
└─────────────┬─────────────┘      └───────────────┬────────────────┘      └──────────┬──────────┘
              │  invokeMigrationFn()                │  invokeMigrationFn()             │
              └──────────────────┬───────────────────┘                                 │
                                  ▼                                                     │
                  supabase.functions.invoke('admin-account-migration')                  │
                                  │                                                     │
                                  ▼                                                     │
              ┌───────────────────────────────────────────────┐                        │
              │  Edge Function: admin-account-migration        │                        │
              │  - authenticates caller, requires admin        │                        │
              │  - validates both accounts                      │                        │
              │  - dry run: read-only counts (JS)                │                        │
              │  - real run: supabase.rpc('admin_migrate_account')                       │
              └───────────────────┬───────────────────────────┘                        │
                                  ▼                                                     │
              ┌───────────────────────────────────────────────┐                        │
              │  admin_migrate_account() (Postgres function)    │────── writes ─────────▶│
              │  - one transaction, all writes                  │                        │
              │  - rollback on any failure                        │                        │
              │  - idempotency guard                              │                        │
              └───────────────────────────────────────────────┘                        │
```

Both admin pages, and every write, go through the **same edge function**.
Neither page ever queries `admin_audit_log`, `profiles`, `wallets`, etc.
directly — the edge function uses the Supabase **service role** key, so it
is the only thing that needs database access, and it is the single place
that enforces admin permissions.

## Flow

1. **Search** — the operator looks up the *Old Account* and *New Account* by
   email, profile ID, or user ID (`action: 'lookup'`). The response includes
   plan, agency, wallet summary, ban status, and whether the account has
   already been the source of a successful migration.
2. **Dry Run** (`dryRun: true`) — counts how many rows in each table would
   be affected. No writes happen. The report (and any errors it turns up)
   is also logged to `admin_audit_log` with `dry_run = true` so it shows up
   in Migration History.
3. **Confirm** — the operator must type `MIGRATE` and pass through a
   confirmation dialog before Execute becomes clickable.
4. **Execute** (`dryRun: false`) — the edge function re-validates both
   accounts, then calls `admin_migrate_account()`, a single Postgres
   function that performs every write inside one transaction. Progress
   labels ("Preparing…", "Migrating wallets…", …) cycle client-side while
   the request is in flight — see [Limitations](#limitations).
5. **Refresh** — on success, the Old Account, New Account, and Migration
   Result panels re-fetch in place, and a `famo:migration-completed`
   `window` event fires so a Migration History view mounted elsewhere can
   refresh too. Nothing here triggers a page reload.

## Permissions

- Client-side: both `AccountMigrationPage` and `MigrationHistoryPage` are
  gated on `useAdminPermissions().permissions.can_manage_users` and render a
  "No permission" card otherwise (`AdminLayout` also hides both sidebar
  links from anyone without that permission).
- Server-side (authoritative): the edge function re-checks admin status on
  every request via `isCallerAdmin()` — a `v_staff_users.can_manage_users`
  row, or the legacy `profiles.isadmin` flag. The client-side check is a UX
  convenience only; it is not what protects the data.
- Database-side: `admin_migrate_account()` and `admin_migration_already_done()`
  have `EXECUTE` revoked from `anon`/`authenticated`/`public` and granted
  only to `service_role`, so they cannot be called directly from a browser
  session even by an authenticated admin — only the edge function (which
  holds the service-role key) can reach them.

## Edge Function

`supabase/functions/admin-account-migration/index.ts`. Actions:

| `action` | Purpose | Writes? |
|---|---|---|
| `lookup` | Resolve an account by email/profile_id/user_id for display | No |
| `migration_status` | Has `oldUserId` already been migrated? | No |
| `history` | Paginated, searchable `admin_audit_log` rows | No |
| *(default, `dryRun: true`)* | Count rows that would move | No |
| *(default, `dryRun: false`)* | Perform the migration | Yes — via `admin_migrate_account()` |

**Validation** (before any dry run or real migration): `oldUserId` and
`newUserId` are valid UUIDs, both resolve to a `profiles` row, they are not
the same id, and neither account is currently banned — a *permanent* active
ban blocks with its own explicit error, a *temporary* active ban blocks with
"profile is not active (currently suspended)". `profiles` has no
`deleted_at`/`is_active` column in this schema (see
ACCOUNT_MIGRATION_SCHEMA.md §1), so "active" is defined as *exists and not
currently banned*.

**Table scope** is unchanged from before this hardening pass — see
`REASSIGN_TABLES` / `RELATIONSHIP_TABLES` / `SENDER_TABLES` / `WALLET_TABLE`
at the top of `index.ts`, mirrored exactly in the SQL function. This pass
hardens *how* the migration runs, not *what* it touches.

## History

`MigrationHistoryPage` lists every row the edge function has ever written to
`admin_audit_log` for `action = 'admin_account_migration'` (dry runs and
real executions both appear, distinguished by the **Dry Run** column),
newest first, 25 per page. **Search** filters server-side (`ILIKE`, `OR`)
across old/new user name & email and manager name & email. **Export CSV**
downloads the current search's full result set (up to 200 rows) as a CSV
with the same 8 columns as the table. Clicking a row opens **Migration
Details** — wallet migration, reassigned tables, relationship tables,
warnings, and a collapsible **Raw JSON** view of the full audit row.

## Recovery

There is **no automated undo**. If a migration needs to be reversed:

1. Open the row in Migration History and expand **Raw JSON** to see exactly
   what moved (which tables, how many rows, the wallet merge note).
2. A **failed** execution (`result = 'failure'`) already rolled itself back
   in the database — no manual cleanup is needed for that row; the
   `details.error` field explains what went wrong.
3. A **successful** execution *did* write data. Reversing it means running
   a migration in the opposite direction (new → old) through this same
   tool, which is only safe if no further activity has happened on the new
   account since — otherwise it will merge the new account's *own*
   subsequent activity back onto the old id. There is deliberately no
   one-click reverse button, because that decision needs a human looking at
   the Raw JSON first.
4. The wallet merge is the one step that is not perfectly reversible by
   construction: once two wallets are summed, the original split of coins/
   gems/xp is only recoverable from the `wallet` object recorded in that
   row's `details` at migration time — read it from there before attempting
   any manual correction.

## Security

- Every write path requires a valid Supabase session JWT **and** an admin
  check that is re-verified server-side on every call (see Permissions).
- The migration write function is a `SECURITY DEFINER` Postgres function
  reachable only by `service_role` — see Permissions above.
- All writes for a real execution happen inside **one Postgres transaction**
  (`admin_migrate_account()`). If any statement fails, everything since the
  start of that migration is rolled back automatically (an inner
  `BEGIN … EXCEPTION WHEN OTHERS` block creates an implicit savepoint), and
  a `failure` row is still recorded — nothing is ever left partially
  migrated, and no attempt is silently lost.
- **Idempotency**: `admin_migrate_account()` checks `admin_audit_log` for an
  existing successful, non-dry-run row with the same `old_user_id` *before*
  doing any writes, and returns `{ success: false, error: 'Already
  migrated.' }` if one exists. `AccountMigrationPage` also disables Execute
  and shows "This account has already been migrated." as soon as the old
  account is loaded, so an operator sees this before typing the confirmation
  phrase — the database check is what actually prevents a double-migration
  if that client-side gate is ever bypassed.
- Every audit row captures `caller_email`, `caller_name`, `ip_address`,
  `user_agent`, `execution_time_ms`, and `total_rows` in addition to the
  existing `performed_by` id, so a migration can always be traced to who
  did it, from where, and how long it took.
- `admin_audit_log` has RLS **enabled with no policies** — it is
  intentionally unreadable to `anon`/`authenticated` sessions; only the
  service-role edge function can read or write it.

## Limitations

- **Progress is simulated, not streamed.** The real migration runs as a
  single synchronous Postgres transaction inside one edge function call —
  there is no per-step channel back to the browser while it's in flight.
  The "Preparing… / Migrating wallets… / Migrating relationships… /
  Migrating tables… / Finishing…" sequence in `AccountMigrationPage` cycles
  on a client-side timer while the request is outstanding; it does not
  reflect the server's actual position. A real per-step progress bar would
  require a streaming/polling channel the edge function does not currently
  provide.
- **Table scope is fixed and intentionally conservative.** Tables flagged
  🔴 in `ACCOUNT_MIGRATION_SCHEMA.md` (agencies, withdrawals, live-session
  state, moderation history, etc.) are excluded on purpose — moving them
  automatically risks financial or moderation-integrity mistakes. Extending
  the table list requires updating both `index.ts` and
  `admin_migrate_account()` together, plus re-verifying the target table's
  schema against the live database first.
- **"Active" profile has no dedicated column.** See the Edge Function
  section above — this schema has no `profiles.deleted_at`/`is_active`
  flag, so "active" is inferred from ban status only.
- **The wallet merge is a one-way sum.** See Recovery — reversing it after
  the fact requires reading the original balances back out of the audit
  row's JSON.
- **RPC schema drift risk.** ~89 of the ~95 `supabase.rpc()` functions
  called from the client have bodies that live only in the database, not in
  this repo (see `ACCOUNT_MIGRATION_SCHEMA.md` §5) — if one of them reads or
  writes user data by a path this migration doesn't reassign, that data
  will not move. This tool only touches the tables listed above.
