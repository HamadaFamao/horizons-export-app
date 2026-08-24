import React, { useCallback, useEffect, useState } from 'react';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { useToast } from '@/components/ui/use-toast';
import { invokeMigrationFn, MIGRATION_COMPLETED_EVENT } from '@/lib/accountMigration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  History,
  Search,
  Loader2,
  ShieldAlert,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
} from 'lucide-react';

const PAGE_SIZE = 25;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

const csvEscape = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const rowToCsvLine = (row) => [
  row.created_at,
  row.caller_name || row.caller_email || row.performed_by,
  row.old_user_name || row.old_user_email || row.old_user_id,
  row.new_user_name || row.new_user_email || row.new_user_id,
  row.dry_run ? 'Yes' : 'No',
  row.result,
  row.total_rows ?? '',
  Array.isArray(row.warnings) ? row.warnings.length : 0,
].map(csvEscape).join(',');

const downloadCsv = (rows) => {
  const header = ['Date', 'Manager', 'Old User', 'New User', 'Dry Run', 'Result', 'Rows Migrated', 'Warnings'].join(',');
  const lines = [header, ...rows.map(rowToCsvLine)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `migration-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const ResultBadge = ({ result }) => {
  if (result === 'success') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Success
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
      <XCircle className="h-3 w-3 mr-1" /> Failure
    </Badge>
  );
};

const detailRows = (details, key) => (details && Array.isArray(details[key]) ? details[key] : []);

const MigrationDetailsDialog = ({ row, open, onOpenChange }) => {
  if (!row) return null;
  const details = row.details || {};
  const wallet = details.wallet;
  const reassignRows = detailRows(details, 'reassignTables');
  const relationshipRows = [...detailRows(details, 'relationshipTables'), ...detailRows(details, 'relationshipCleanup')];
  const warnings = Array.isArray(row.warnings) ? row.warnings : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Migration Details</DialogTitle>
          <DialogDescription>
            {formatDate(row.created_at)} · {row.dry_run ? 'Dry Run' : 'Executed'} · <ResultBadge result={row.result} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-500">Manager</span>
            <span className="font-medium">{row.caller_name || row.caller_email || row.performed_by || '—'}</span>
            <span className="text-slate-500">Old User</span>
            <span className="font-mono text-xs break-all">{row.old_user_name || row.old_user_email || row.old_user_id}</span>
            <span className="text-slate-500">New User</span>
            <span className="font-mono text-xs break-all">{row.new_user_name || row.new_user_email || row.new_user_id}</span>
            <span className="text-slate-500">Rows Migrated</span>
            <span>{row.total_rows ?? '—'}</span>
            <span className="text-slate-500">Execution Time</span>
            <span>{row.execution_time_ms != null ? `${row.execution_time_ms} ms` : '—'}</span>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-1"><Wallet className="h-4 w-4" /> Wallet Migration</h3>
            {wallet ? (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className={wallet.error ? 'text-red-600' : 'text-purple-800'}>{wallet.note || '—'}</p>
                {wallet.error && <p className="text-red-500 text-xs mt-1">⚠️ {wallet.error}</p>}
              </div>
            ) : (
              <p className="text-slate-400 text-xs">No wallet data recorded.</p>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Reassigned Tables</h3>
            {reassignRows.length === 0 ? (
              <p className="text-slate-400 text-xs">No rows.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {reassignRows.map((r, i) => (
                  <li key={`${r.table}-${i}`} className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-medium">{r.table}.{r.column}</span>
                    <span>{r.updated ?? r.matched ?? 0} row(s){r.error ? ` — ⚠️ ${r.error}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Relationship Tables</h3>
            {relationshipRows.length === 0 ? (
              <p className="text-slate-400 text-xs">No rows.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {relationshipRows.map((r, i) => (
                  <li key={`${r.table}-${i}`} className="flex justify-between border-b border-slate-100 py-1">
                    <span className="font-medium">{r.table}{r.column ? `.${r.column}` : ' (cleanup)'}</span>
                    <span>{r.updated ?? r.removed ?? 0} row(s){r.error ? ` — ⚠️ ${r.error}` : ''}</span>
                  </li>
                ))}
              </ul>
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

          <Accordion type="single" collapsible>
            <AccordionItem value="raw-json">
              <AccordionTrigger className="text-sm font-semibold">Raw JSON</AccordionTrigger>
              <AccordionContent>
                <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(row, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function MigrationHistoryPage() {
  const { permissions, loading: permLoading } = useAdminPermissions();
  const { toast } = useToast();
  const canAccess = !!permissions?.can_manage_users;

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchHistory = useCallback(async (pageNum, searchTerm) => {
    setLoading(true);
    setError('');
    try {
      const data = await invokeMigrationFn({ action: 'history', page: pageNum, pageSize: PAGE_SIZE, search: searchTerm });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    fetchHistory(page, search);
  }, [canAccess, page, search, fetchHistory]);

  // Requirement 10: refresh without a page reload when a migration completes
  // elsewhere (e.g. the Account Migration page, if both are mounted).
  useEffect(() => {
    if (!canAccess) return undefined;
    const handler = () => fetchHistory(page, search);
    window.addEventListener(MIGRATION_COMPLETED_EVENT, handler);
    return () => window.removeEventListener(MIGRATION_COMPLETED_EVENT, handler);
  }, [canAccess, page, search, fetchHistory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      // Export the full filtered result set, not just the current page.
      const data = await invokeMigrationFn({ action: 'history', page: 0, pageSize: 200, search });
      if (!data.rows?.length) {
        toast({ title: 'Nothing to export', description: 'No migration history rows match the current search.' });
        return;
      }
      downloadCsv(data.rows);
      toast({ title: '📄 CSV exported' });
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const openDetails = (row) => {
    setSelectedRow(row);
    setDetailsOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!permLoading && !canAccess) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-4">Migration History</h1>
        <Card className="border-t-4 border-t-red-500">
          <CardContent className="py-8">
            <div className="flex items-start gap-3 text-red-700">
              <ShieldAlert className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">No permission to view this page.</p>
                <p className="text-sm text-red-600 mt-1">You must have Manager permissions (Manage Users) to access Migration History.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-rose-500" />
            Migration History
          </h1>
          <p className="text-sm text-slate-500 mt-1">Every Account Migration attempt, newest first.</p>
        </div>
        <Button onClick={handleExportCsv} disabled={exporting} variant="outline" className="sm:min-w-[9rem]">
          {exporting ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Exporting...</span>
          ) : (
            <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" /> Export CSV</span>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search by Old User, New User, or Manager..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="sm:max-w-sm"
            />
            <Button type="submit" disabled={loading}>
              <span className="inline-flex items-center gap-2"><Search className="h-4 w-4" /> Search</span>
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setSearchInput(''); setSearch(''); setPage(0); }}
              >
                Clear
              </Button>
            )}
          </form>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Old User</TableHead>
                  <TableHead>New User</TableHead>
                  <TableHead>Dry Run</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Rows Migrated</TableHead>
                  <TableHead>Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</span>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-slate-400 py-8">No migrations found.</TableCell>
                  </TableRow>
                )}
                {!loading && rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDetails(row)}
                  >
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(row.created_at)}</TableCell>
                    <TableCell className="text-sm">{row.caller_name || row.caller_email || '—'}</TableCell>
                    <TableCell className="text-sm">
                      <div>{row.old_user_name || '—'}</div>
                      <div className="text-xs text-slate-400">{row.old_user_email || row.old_user_id}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{row.new_user_name || '—'}</div>
                      <div className="text-xs text-slate-400">{row.new_user_email || row.new_user_id}</div>
                    </TableCell>
                    <TableCell>{row.dry_run ? 'Yes' : 'No'}</TableCell>
                    <TableCell><ResultBadge result={row.result} /></TableCell>
                    <TableCell>{row.total_rows ?? '—'}</TableCell>
                    <TableCell>{Array.isArray(row.warnings) ? row.warnings.length : 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{total} total migration{total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <span>Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <MigrationDetailsDialog row={selectedRow} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}
