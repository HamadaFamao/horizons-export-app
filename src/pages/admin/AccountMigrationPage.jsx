import React, { useEffect, useRef, useState } from 'react';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { invokeMigrationFn, MIGRATION_COMPLETED_EVENT } from '@/lib/accountMigration';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { DEFAULT_AVATAR } from '@/lib/constants';
import {
  ArrowRightLeft,
  Search,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Wallet,
} from 'lucide-react';

const SEARCH_OPTIONS = [
  { label: 'Email', value: 'email' },
  { label: 'Profile ID', value: 'profile_id' },
  { label: 'User ID', value: 'user_id' },
];

const CONFIRM_PHRASE = 'MIGRATE';

// The real migration runs as a single Postgres transaction on the server
// (see admin_migrate_account() in SUPABASE_ACCOUNT_MIGRATION_HARDENING.sql),
// so there is no real per-step progress to stream back. This cycles through
// the stage labels client-side while the request is in flight, purely as a
// visual affordance — the last label is held until the response arrives.
const PROGRESS_STAGES = ['Preparing...', 'Migrating wallets...', 'Migrating relationships...', 'Migrating tables...', 'Finishing...'];
const PROGRESS_STAGE_INTERVAL_MS = 700;

const VIP_LABELS = { 1: 'Spark Week', 2: 'VIP Silver', 3: 'VIP Gold', 4: 'VIP Platinum' };

const formatPlan = (plan) => {
  if (!plan || !plan.isVip) return 'Free';
  const label = VIP_LABELS[plan.vipNumber] || 'VIP';
  if (!plan.vipUntil) return label;
  const until = new Date(plan.vipUntil);
  if (Number.isNaN(until.getTime())) return label;
  if (until <= new Date()) return `${label} (expired)`;
  return `${label} · until ${until.toLocaleDateString()}`;
};

// Flattens every "reassign-style" row (matched/updated + optional error) out
// of a dry-run report or an execute result, regardless of which section it
// came from. Used to total row counts and to detect per-table errors.
const flattenRows = (result) => {
  if (!result) return [];
  const isDryRun = !!result.dryRun;
  if (isDryRun) {
    return [
      ...(result.report?.reassignTables || []).map((r) => ({ ...r, count: r.matched })),
      ...(result.report?.senderTables || []).map((r) => ({ ...r, count: r.matched })),
      ...(result.report?.relationshipTables || []).map((r) => ({ ...r, count: r.matched })),
    ];
  }
  return [
    ...(result.results?.reassignTables || []).map((r) => ({ ...r, count: r.updated })),
    ...(result.results?.senderTables || []).map((r) => ({ ...r, count: r.updated })),
    ...(result.results?.relationshipTables || []).map((r) => ({ ...r, count: r.updated })),
    ...(result.results?.relationshipCleanup || []).map((r) => ({
      table: r.table,
      column: '(self-pair cleanup)',
      count: r.removed,
      error: r.error,
    })),
  ];
};

const AccountSearchPanel = ({ title, accent, searchBy, setSearchBy, query, setQuery, account, loading, error, onSearch, showMigratedWarning }) => (
  <Card className={`border-t-4 ${accent.border}`}>
    <CardContent className="p-4 md:p-6">
      <h2 className="text-lg font-bold mb-4">{title}</h2>

      <form
        onSubmit={(e) => { e.preventDefault(); onSearch(); }}
        className="flex flex-col sm:flex-row gap-2 mb-4"
      >
        <select
          value={searchBy}
          onChange={(e) => setSearchBy(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-40"
        >
          {SEARCH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Input
          placeholder={`Search by ${SEARCH_OPTIONS.find((o) => o.value === searchBy)?.label.toLowerCase()}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={loading || !query.trim()} className="sm:min-w-[7.5rem]">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Search className="h-4 w-4" /> Search
            </span>
          )}
        </Button>
      </form>

      {error && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!account && !error && (
        <p className="text-sm text-slate-400">No account loaded yet.</p>
      )}

      {account && showMigratedWarning && account.alreadyMigrated && (
        <div className="flex items-start gap-2 text-red-700 text-sm bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">This account has already been migrated.</p>
            {account.migratedAt && (
              <p className="text-xs text-red-600 mt-0.5">
                Migrated on {new Date(account.migratedAt).toLocaleString()}.
              </p>
            )}
          </div>
        </div>
      )}

      {account && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={account.avatarUrl || DEFAULT_AVATAR}
              onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
              alt="avatar"
              className="w-14 h-14 rounded-full object-cover border"
            />
            <div>
              <p className="font-semibold text-slate-800">{account.name || '—'}</p>
              <p className="text-sm text-slate-500">{account.email || '—'}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Profile ID</dt>
            <dd className="font-mono text-slate-800">{account.profileId ?? '—'}</dd>

            <dt className="text-slate-500">User ID</dt>
            <dd className="font-mono text-xs text-slate-800 break-all">{account.id}</dd>

            <dt className="text-slate-500">Current Plan</dt>
            <dd className="text-slate-800">{formatPlan(account.plan)}</dd>

            <dt className="text-slate-500">Agency</dt>
            <dd className="text-slate-800">{account.agency?.agencyName || '— None —'}</dd>
          </dl>

          <div>
            <p className="text-slate-500 text-sm mb-1">Wallet Summary</p>
            {account.wallet ? (
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">🪙 {account.wallet.coins ?? 0} coins</span>
                <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded-full">💎 {account.wallet.gems ?? 0} gems</span>
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full">⭐ Lv.{account.wallet.level ?? 1}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">✨ {account.wallet.xp ?? 0} xp</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">No wallet found</span>
            )}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);

const ResultTable = ({ rows, countLabel }) => (
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Table</TableHead>
          <TableHead>Column</TableHead>
          <TableHead>{countLabel}</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow><TableCell colSpan={4} className="text-center text-slate-400">No rows</TableCell></TableRow>
        )}
        {rows.map((r, i) => (
          <TableRow key={`${r.table}-${r.column}-${i}`}>
            <TableCell className="font-medium">{r.table}</TableCell>
            <TableCell className="font-mono text-xs">{r.column}</TableCell>
            <TableCell>{r.count}</TableCell>
            <TableCell>
              {r.error ? (
                <span className="text-red-600 text-xs">⚠️ {r.error}</span>
              ) : (
                <span className="text-green-600 text-xs">✅ OK</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const MigrationResultPanel = ({ result }) => {
  if (!result) return null;
  const isDryRun = !!result.dryRun;

  const reassignRows = isDryRun
    ? [
        ...(result.report?.reassignTables || []).map((r) => ({ ...r, count: r.matched })),
        ...(result.report?.senderTables || []).map((r) => ({ ...r, count: r.matched })),
      ]
    : [
        ...(result.results?.reassignTables || []).map((r) => ({ ...r, count: r.updated })),
        ...(result.results?.senderTables || []).map((r) => ({ ...r, count: r.updated })),
      ];

  const relationshipRows = isDryRun
    ? (result.report?.relationshipTables || []).map((r) => ({ ...r, count: r.matched }))
    : [
        ...(result.results?.relationshipTables || []).map((r) => ({ ...r, count: r.updated })),
        ...(result.results?.relationshipCleanup || []).map((r) => ({
          table: r.table,
          column: '(self-pair cleanup)',
          count: r.removed,
          error: r.error,
        })),
      ];

  const wallet = isDryRun ? result.report?.wallet : result.results?.wallet;

  // The dry-run endpoint doesn't return a top-level `warnings` array — derive
  // one from any per-table row that came back with an error. The execute
  // endpoint already returns `warnings`, so use that directly.
  const warnings = isDryRun
    ? [...reassignRows, ...relationshipRows]
        .filter((r) => r.error)
        .map((r) => `${r.table} (${r.column}): ${r.error}`)
    : (result.warnings || []);

  const totalRows = [...reassignRows, ...relationshipRows].reduce((sum, r) => sum + (r.count || 0), 0);

  const walletSummary = isDryRun
    ? (wallet?.oldWalletExists
        ? `🪙 ${wallet.oldWallet?.coins ?? 0} · 💎 ${wallet.oldWallet?.gems ?? 0} · ⭐ Lv.${wallet.oldWallet?.level ?? 1} · ✨ ${wallet.oldWallet?.xp ?? 0} will be ${wallet.newWalletExists ? 'merged into the new account\'s wallet' : "moved to the new account (it has no wallet yet)"}.`
        : 'No wallet on the old account — nothing to migrate.')
    : (wallet?.note || 'No wallet activity.');

  return (
    <Card className={`border-t-4 ${isDryRun ? 'border-t-blue-500' : 'border-t-emerald-500'}`}>
      <CardContent className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          {isDryRun ? (
            <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-1 rounded-full text-xs font-bold">
              🔍 Dry Run Report
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full text-xs font-bold">
              ✅ Migration Executed
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 border rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              {isDryRun ? 'Rows that will be migrated' : 'Rows migrated'}
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalRows}</p>
          </div>

          {/* Wallet migration is highlighted separately from the row-count tables below. */}
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-purple-700 font-semibold flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> Wallet Migration
            </p>
            <p className={`text-sm mt-1 ${wallet?.error ? 'text-red-600' : 'text-purple-800'}`}>{walletSummary}</p>
            {wallet?.error && <p className="text-red-500 text-xs mt-1">⚠️ {wallet.error}</p>}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Reassign Tables</h3>
          <ResultTable rows={reassignRows} countLabel={isDryRun ? 'Would Update' : 'Updated'} />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Relationship Tables</h3>
          <ResultTable rows={relationshipRows} countLabel={isDryRun ? 'Would Update' : 'Updated / Removed'} />
        </div>

        <div>
          <h3 className="font-semibold mb-2">Wallet Detail</h3>
          {isDryRun ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-lg p-3 border">
                <p className="font-medium text-slate-600 mb-1">Old Wallet</p>
                {wallet?.oldWalletExists ? (
                  <p className="text-slate-800">
                    🪙 {wallet.oldWallet?.coins ?? 0} · 💎 {wallet.oldWallet?.gems ?? 0} · ⭐ Lv.{wallet.oldWallet?.level ?? 1} · ✨ {wallet.oldWallet?.xp ?? 0}
                  </p>
                ) : (
                  <p className="text-slate-400">No wallet</p>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border">
                <p className="font-medium text-slate-600 mb-1">New Wallet</p>
                {wallet?.newWalletExists ? (
                  <p className="text-slate-800">
                    🪙 {wallet.newWallet?.coins ?? 0} · 💎 {wallet.newWallet?.gems ?? 0} · ⭐ Lv.{wallet.newWallet?.level ?? 1} · ✨ {wallet.newWallet?.xp ?? 0}
                  </p>
                ) : (
                  <p className="text-slate-400">No wallet</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm bg-slate-50 rounded-lg p-3 border">
              <p className={wallet?.error ? 'text-red-600' : 'text-slate-800'}>{wallet?.note}</p>
              {wallet?.error && <p className="text-red-500 text-xs mt-1">⚠️ {wallet.error}</p>}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-2">Warnings</h3>
          {warnings.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> No warnings</p>
          ) : (
            <ul className="text-sm text-orange-700 bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function AccountMigrationPage() {
  const { permissions, loading: permLoading } = useAdminPermissions();
  const { toast } = useToast();
  const canAccess = !!permissions?.can_manage_users;

  // Old / new account search state
  const [oldSearchBy, setOldSearchBy] = useState('email');
  const [oldQuery, setOldQuery] = useState('');
  const [oldAccount, setOldAccount] = useState(null);
  const [oldLoading, setOldLoading] = useState(false);
  const [oldError, setOldError] = useState('');

  const [newSearchBy, setNewSearchBy] = useState('email');
  const [newQuery, setNewQuery] = useState('');
  const [newAccount, setNewAccount] = useState(null);
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError] = useState('');

  // Migration state
  const [dryRunChecked, setDryRunChecked] = useState(true);
  const [checking, setChecking] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [progressLabel, setProgressLabel] = useState('');

  // Guards against a double-click firing two overlapping requests — state
  // updates from setChecking/setExecuting are async, so the disabled=
  // attribute alone can't be trusted to block a second click in time.
  const busyRef = useRef(false);
  const progressTimerRef = useRef(null);

  useEffect(() => () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  }, []);

  const startProgress = () => {
    let step = 0;
    setProgressLabel(PROGRESS_STAGES[0]);
    progressTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, PROGRESS_STAGES.length - 1);
      setProgressLabel(PROGRESS_STAGES[step]);
    }, PROGRESS_STAGE_INTERVAL_MS);
  };

  const stopProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgressLabel('');
  };

  const searchAccount = async (side, { silent = false } = {}) => {
    const isOld = side === 'old';
    const searchBy = isOld ? oldSearchBy : newSearchBy;
    const query = isOld ? oldQuery : newQuery;
    const setLoading = isOld ? setOldLoading : setNewLoading;
    const setError = isOld ? setOldError : setNewError;
    const setAccount = isOld ? setOldAccount : setNewAccount;

    if (!query.trim()) return;

    setLoading(true);
    setError('');
    try {
      const data = await invokeMigrationFn({ action: 'lookup', searchBy, query: query.trim() });
      setAccount(data.account);
      if (!silent) {
        setMigrationResult(null);
        setConfirmText('');
      }
    } catch (err) {
      setAccount(null);
      setError(err.message);
      if (!silent) {
        setMigrationResult(null);
        setConfirmText('');
      }
    } finally {
      setLoading(false);
    }
  };

  const performMigration = async (isDryRun) => {
    if (busyRef.current) return;
    if (!oldAccount || !newAccount) {
      toast({ title: 'Select both accounts first', description: 'Search and load the old and new accounts before checking a migration.', variant: 'destructive' });
      return;
    }
    if (oldAccount.id === newAccount.id) {
      toast({ title: 'Old and new accounts must be different', variant: 'destructive' });
      return;
    }
    if (!isDryRun && oldAccount.alreadyMigrated) {
      toast({ title: 'This account has already been migrated.', variant: 'destructive' });
      return;
    }

    // Every fresh dry run invalidates any previously typed confirmation —
    // the operator must re-confirm against the latest report.
    if (isDryRun) setConfirmText('');

    busyRef.current = true;
    isDryRun ? setChecking(true) : setExecuting(true);
    if (!isDryRun) startProgress();

    try {
      const data = await invokeMigrationFn({
        action: 'migrate',
        oldUserId: oldAccount.id,
        newUserId: newAccount.id,
        dryRun: isDryRun,
      });

      setMigrationResult(data);

      if (isDryRun) {
        toast({ title: '🔍 Dry run complete', description: 'Review the report below, then Execute Migration when ready.' });
      } else {
        toast({ title: '✅ Migration executed successfully' });
        setConfirmText('');
        // Refresh both account panels and re-run a dry run so the report
        // (and its row counts) reflect the post-migration state.
        await Promise.all([
          searchAccount('old', { silent: true }),
          searchAccount('new', { silent: true }),
        ]);
        // Let any other mounted page (Migration History) refresh itself.
        window.dispatchEvent(new CustomEvent(MIGRATION_COMPLETED_EVENT, {
          detail: { oldUserId: oldAccount.id, newUserId: newAccount.id },
        }));
      }
    } catch (err) {
      toast({
        title: isDryRun ? 'Dry run failed' : 'Migration failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      isDryRun ? setChecking(false) : setExecuting(false);
      if (!isDryRun) stopProgress();
      busyRef.current = false;
    }
  };

  const handleCheckMigration = () => {
    if (dryRunChecked) {
      performMigration(true);
    } else {
      // Unchecking "Dry Run" means Check Migration would write for real —
      // route it through the same confirmation as Execute Migration.
      setConfirmOpen(true);
    }
  };

  const handleConfirmExecute = () => {
    if (busyRef.current) return;
    setConfirmOpen(false);
    performMigration(false);
  };

  // ── Safety gating ──────────────────────────────────────────────────────
  const oldFound = !!oldAccount;
  const newFound = !!newAccount;
  const sameAccount = oldFound && newFound && oldAccount.id === newAccount.id;
  // Rollback protection: oldUserId already the source of a successful
  // migration (checked server-side and re-enforced by the DB function's own
  // idempotency guard even if this client-side gate is bypassed).
  const alreadyMigrated = oldFound && !!oldAccount.alreadyMigrated;

  const dryRunSucceeded = migrationResult?.success && migrationResult?.dryRun === true;
  const dryRunRows = dryRunSucceeded ? flattenRows(migrationResult) : [];
  const dryRunHasErrors = dryRunRows.some((r) => r.error);

  const canCheckMigration = oldFound && newFound && !sameAccount && !alreadyMigrated;

  const canExecute =
  dryRunSucceeded &&
  oldFound &&
  newFound &&
  !sameAccount &&
  !alreadyMigrated &&
  !dryRunHasErrors &&
  confirmText.trim() === CONFIRM_PHRASE;

  if (!permLoading && !canAccess) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-4">Account Migration</h1>
        <Card className="border-t-4 border-t-red-500">
          <CardContent className="py-8">
            <div className="flex items-start gap-3 text-red-700">
              <ShieldAlert className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">No permission to view this page.</p>
                <p className="text-sm text-red-600 mt-1">You must have Manager permissions (Manage Users) to access Account Migration.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-rose-500" />
          Account Migration
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Transfer all data owned by an old account to a new account. Every operation runs through the
          <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs">admin-account-migration</code>
          edge function — nothing here touches the database directly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountSearchPanel
          title="Old Account"
          accent={{ border: 'border-t-rose-500' }}
          searchBy={oldSearchBy}
          setSearchBy={setOldSearchBy}
          query={oldQuery}
          setQuery={setOldQuery}
          account={oldAccount}
          loading={oldLoading}
          error={oldError}
          onSearch={() => searchAccount('old')}
          showMigratedWarning
        />
        <AccountSearchPanel
          title="New Account"
          accent={{ border: 'border-t-blue-500' }}
          searchBy={newSearchBy}
          setSearchBy={setNewSearchBy}
          query={newQuery}
          setQuery={setNewQuery}
          account={newAccount}
          loading={newLoading}
          error={newError}
          onSearch={() => searchAccount('new')}
        />
      </div>

      {sameAccount && (
        <div className="flex items-start gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>The old and new accounts are the same account. Load two different accounts to continue.</span>
        </div>
      )}

      <Card className="border-t-4 border-t-amber-500">
        <CardContent className="p-4 md:p-6 space-y-4">
          <h2 className="text-lg font-bold">Migration</h2>

          {/* Requirement: red irreversibility warning, always visible on this card. */}
          <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg p-4 text-red-700">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">⚠ This operation is irreversible.</p>
              <p className="text-sm text-red-600 mt-1">
                Executing the migration permanently moves data from the old account to the new account. There is no automatic undo.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dry-run"
                checked={dryRunChecked}
                onCheckedChange={(val) => setDryRunChecked(!!val)}
              />
              <Label htmlFor="dry-run" className="cursor-pointer">Dry Run</Label>
            </div>

            <Button onClick={handleCheckMigration} disabled={!canCheckMigration || checking || executing} className="sm:min-w-[9rem]">
              {checking ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Dry Run...</span>
              ) : (
                'Check Migration'
              )}
            </Button>

            <div className="flex flex-col gap-1">
              <Label htmlFor="confirm-migrate" className="text-xs text-slate-500">
                Type {CONFIRM_PHRASE} to enable Execute
              </Label>
              <Input
                id="confirm-migrate"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                disabled={!dryRunSucceeded || dryRunHasErrors || sameAccount}
                className="sm:w-40 font-mono"
              />
            </div>

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canExecute || checking || executing}
              className="bg-red-600 hover:bg-red-700 text-white sm:min-w-[9rem]"
            >
              {executing ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Executing...</span>
              ) : (
                'Execute Migration'
              )}
            </Button>
          </div>

          {executing && progressLabel && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{progressLabel}</span>
            </div>
          )}

          {alreadyMigrated && (
            <div className="flex items-start gap-2 text-red-700 text-sm bg-red-50 border border-red-300 rounded-lg p-3">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>This account has already been migrated.</span>
            </div>
          )}

          {!canExecute && !executing && (
            <p className="text-xs text-slate-400">
              {(!oldFound || !newFound) && 'Search and load both accounts. '}
              {oldFound && newFound && sameAccount && 'Old and new accounts must be different. '}
              {oldFound && newFound && !sameAccount && alreadyMigrated && 'This account has already been migrated. '}
              {oldFound && newFound && !sameAccount && !alreadyMigrated && !dryRunSucceeded && 'Run a successful Dry Run check to unlock Execute Migration. '}
              {dryRunSucceeded && dryRunHasErrors && 'One or more tables returned an error in the dry run — resolve it before executing. '}
              {dryRunSucceeded && !dryRunHasErrors && !sameAccount && !alreadyMigrated && confirmText.trim() !== CONFIRM_PHRASE && `Type ${CONFIRM_PHRASE} above to enable Execute.`}
            </p>
          )}

          {dryRunSucceeded && !dryRunHasErrors && (
            <p className="text-xs text-slate-500">
              Last dry run would migrate {dryRunRows.reduce((sum, r) => sum + (r.count || 0), 0)} row(s) across {dryRunRows.length} table entr{dryRunRows.length === 1 ? 'y' : 'ies'}, plus the wallet (see report below).
            </p>
          )}
        </CardContent>
      </Card>

      <MigrationResultPanel result={migrationResult} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Migration</AlertDialogTitle>
            <AlertDialogDescription>
              This operation permanently transfers all data from the old account to the new account.
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExecute} disabled={executing} className="bg-red-600 hover:bg-red-700 text-white">
              {executing ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Executing...</span>
              ) : (
                'Execute'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
