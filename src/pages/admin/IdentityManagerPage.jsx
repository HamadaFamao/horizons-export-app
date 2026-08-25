import React, { useState } from 'react';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { invokeMigrationFn } from '@/lib/accountMigration';
import { invokeIdentityFn } from '@/lib/identityManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DEFAULT_AVATAR } from '@/lib/constants';
import {
  Fingerprint,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Mic,
  Lock,
  KeyRound,
  Mail,
} from 'lucide-react';

// Step 1 of Identity Manager: a read-only account lookup panel. Search logic
// is intentionally identical to Account Migration's — both pages call the
// same `admin-account-migration` edge function action ('lookup') so the
// account-resolution logic lives in exactly one place (see index.ts).
//
// Step 2 adds two more cards, backed by a separate `admin-identity-manager`
// edge function that only ever reads/writes `auth.users` — never account
// migration, never application data:
//   - "Login Identity": read-only auth.users fields for the looked-up account.
//   - "Replace Login Identity": lets an admin change the account's login
//     email. The Auth User ID never changes and the new email only takes
//     effect once the user confirms it (see admin-identity-manager/index.ts).

const SEARCH_OPTIONS = [
  { label: 'Email', value: 'email' },
  { label: 'Profile ID', value: 'profile_id' },
  { label: 'User ID', value: 'user_id' },
];

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

const formatRole = (value) => {
  if (!value || value === 'none') return '— None —';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function IdentityManagerPage() {
  const { permissions, loading: permLoading } = useAdminPermissions();
  const canAccess = !!permissions?.can_manage_users;

  const [searchBy, setSearchBy] = useState('email');
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2 — Login Identity (auth.users, read-only)
  const [identity, setIdentity] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState('');

  // Step 2 — Replace Login Identity
  const [newEmail, setNewEmail] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');

  const loadIdentity = async (userId) => {
    setIdentityLoading(true);
    setIdentityError('');
    try {
      const data = await invokeIdentityFn({ action: 'get_login_identity', userId });
      setIdentity(data.identity);
    } catch (err) {
      setIdentity(null);
      setIdentityError(err.message);
    } finally {
      setIdentityLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setIdentity(null);
    setIdentityError('');
    setNewEmail('');
    setChangeError('');
    setChangeSuccess('');
    try {
      const data = await invokeMigrationFn({ action: 'lookup', searchBy, query: query.trim() });
      setAccount(data.account);
      loadIdentity(data.account.id);
    } catch (err) {
      setAccount(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    const target = newEmail.trim();
    if (!account || !target) return;
    setChangeLoading(true);
    setChangeError('');
    setChangeSuccess('');
    try {
      const data = await invokeIdentityFn({ action: 'change_login_email', userId: account.id, newEmail: target });
      setChangeSuccess(data.message || 'Verification email sent.');
      setNewEmail('');
    } catch (err) {
      setChangeError(err.message);
    } finally {
      setChangeLoading(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return 'Never';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  if (!permLoading && !canAccess) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-4">Identity Manager</h1>
        <Card className="border-t-4 border-t-red-500">
          <CardContent className="py-8">
            <div className="flex items-start gap-3 text-red-700">
              <ShieldAlert className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">No permission to view this page.</p>
                <p className="text-sm text-red-600 mt-1">You must have Manager permissions (Manage Users) to access Identity Manager.</p>
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
          <Fingerprint className="w-6 h-6 text-rose-500" />
          Identity Manager
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage user login identities without migrating account data.
        </p>
      </div>

      <Card className="border-t-4 border-t-rose-500">
        <CardContent className="p-4 md:p-6">
          <h2 className="text-lg font-bold mb-4">Account Lookup</h2>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
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

          {account && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img
                  src={account.avatarUrl || DEFAULT_AVATAR}
                  onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                  alt="avatar"
                  className="w-16 h-16 rounded-full object-cover border"
                />
                <div>
                  <p className="font-semibold text-lg text-slate-800">{account.name || '—'}</p>
                  <p className="text-sm text-slate-500">{account.email || '—'}</p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-slate-500">User ID</dt>
                <dd className="font-mono text-xs text-slate-800 break-all">{account.id}</dd>

                <dt className="text-slate-500">Profile ID</dt>
                <dd className="font-mono text-slate-800">{account.profileId ?? '—'}</dd>

                <dt className="text-slate-500">VIP</dt>
                <dd className="text-slate-800">{formatPlan(account.plan)}</dd>

                <dt className="text-slate-500">Agency</dt>
                <dd className="text-slate-800">{account.agency?.agencyName || '— None —'}</dd>

                <dt className="text-slate-500">Admin Role</dt>
                <dd className="text-slate-800">
                  {account.isAdmin || account.adminRole ? (
                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                      <ShieldCheck className="h-3 w-3" /> {formatRole(account.adminRole) === '— None —' ? 'Admin' : formatRole(account.adminRole)}
                    </span>
                  ) : '— None —'}
                </dd>

                <dt className="text-slate-500">Staff Role</dt>
                <dd className="text-slate-800">{formatRole(account.staffRole)}</dd>

                <dt className="text-slate-500">Room Owner</dt>
                <dd className="text-slate-800">
                  {account.isRoomOwner ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                      <Mic className="h-3 w-3" /> Owns a live room
                    </span>
                  ) : 'No live room'}
                </dd>
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

              {account.isRoomOwner && account.room && (
                <Card className="border-t-4 border-t-blue-500">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Mic className="h-4 w-4 text-blue-500" /> Live Room
                    </h3>
                    <div className="flex items-center gap-3">
                      <img
                        src={account.room.coverUrl || DEFAULT_AVATAR}
                        onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                        alt="room cover"
                        className="w-12 h-12 rounded-lg object-cover border"
                      />
                      <div>
                        <p className="font-medium text-slate-800">{account.room.title || 'Untitled room'}</p>
                        {account.room.publicRoomId != null && (
                          <p className="text-xs text-slate-500">#{account.room.publicRoomId}</p>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-slate-500">Room ID</dt>
                      <dd className="font-mono text-xs text-slate-800 break-all">{account.room.id}</dd>

                      <dt className="text-slate-500">Room Name</dt>
                      <dd className="text-slate-800">{account.room.title || '—'}</dd>

                      <dt className="text-slate-500">Room Cover</dt>
                      <dd className="text-slate-800 break-all">
                        {account.room.coverUrl ? (
                          <span className="text-xs font-mono">{account.room.coverUrl}</span>
                        ) : '— None —'}
                      </dd>

                      <dt className="text-slate-500">Room Status</dt>
                      <dd className="text-slate-800">
                        {account.room.isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                            🟢 Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                            Inactive
                          </span>
                        )}
                        {account.room.isLocked && (
                          <span className="ml-2 inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                            <Lock className="h-3 w-3" /> Locked
                          </span>
                        )}
                      </dd>
                    </dl>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {account && (
        <Card className="border-t-4 border-t-rose-500">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-rose-500" />
              Login Identity
            </h2>

            {identityLoading && (
              <p className="text-sm text-slate-400 inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading login identity...
              </p>
            )}

            {!identityLoading && identityError && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{identityError}</span>
              </div>
            )}

            {!identityLoading && !identityError && identity && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-slate-500">Current Auth User ID</dt>
                <dd className="font-mono text-xs text-slate-800 break-all">{identity.authUserId}</dd>

                <dt className="text-slate-500">Current Provider</dt>
                <dd className="text-slate-800 capitalize">{identity.provider || '—'}</dd>

                <dt className="text-slate-500">Current Email</dt>
                <dd className="text-slate-800 break-all">{identity.email || '—'}</dd>

                <dt className="text-slate-500">Email Confirmed</dt>
                <dd className="text-slate-800">
                  {identity.emailConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                      <CheckCircle2 className="h-3 w-3" /> Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                      Unconfirmed
                    </span>
                  )}
                </dd>

                <dt className="text-slate-500">Last Sign In</dt>
                <dd className="text-slate-800">{formatDateTime(identity.lastSignInAt)}</dd>
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      {account && (
        <Card className="border-t-4 border-t-amber-500">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              Replace Login Identity
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Sends a verification email to the new address. The login email only changes once the user confirms it —
              the Auth User ID stays the same, and no profile, wallet, room, VIP, or agency data is touched.
            </p>

            <form onSubmit={handleChangeEmail} className="flex flex-col sm:flex-row gap-2 mb-4">
              <Input
                type="email"
                placeholder="New email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="sm:flex-1"
              />
              <Button
                type="submit"
                disabled={changeLoading || !newEmail.trim() || !identity}
                className="sm:min-w-[13rem]"
              >
                {changeLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Send Verification Email
                  </span>
                )}
              </Button>
            </form>

            {changeError && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{changeError}</span>
              </div>
            )}

            {changeSuccess && (
              <div className="flex items-start gap-2 text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{changeSuccess}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
