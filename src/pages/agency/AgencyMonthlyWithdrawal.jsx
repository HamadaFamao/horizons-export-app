import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertTriangle, CheckCircle2, Wallet, Users, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function AgencyMonthlyWithdrawal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Data State
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState(null);
  const [snapshotRows, setSnapshotRows] = useState([]);
  const [rechargeAgents, setRechargeAgents] = useState([]);

  // ✅ Cycle computed balances (not wallet)
  const [usedCycleGems, setUsedCycleGems] = useState(0);
  const [availableCycleGems, setAvailableCycleGems] = useState(0);

  // Form State
  const [amount, setAmount] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchCycleUsage = async (cycleId, lockedGems) => {
    // 1) Get requests for this cycle that should reserve balance
    const { data: reqs, error: reqErr } = await supabase
      .from('gem_withdrawal_requests')
      .select('batch_id, status')
      .eq('cycle_id', cycleId)
      .in('status', ['pending', 'approved', 'paid', 'processing']);

    if (reqErr) throw reqErr;

    const batchIds = (reqs || []).map(r => r.batch_id).filter(Boolean);
    if (batchIds.length === 0) {
      setUsedCycleGems(0);
      const avail = Math.max((lockedGems || 0), 0);
      setAvailableCycleGems(avail);
      setAmount(avail > 0 ? String(avail) : '');
      return;
    }

    // 2) Sum splits for those batches
    const { data: splits, error: splitErr } = await supabase
      .from('gem_withdrawal_splits')
      .select('batch_id, gems')
      .in('batch_id', batchIds);

    if (splitErr) throw splitErr;

    const used = (splits || []).reduce((sum, s) => sum + (Number(s.gems) || 0), 0);
    setUsedCycleGems(used);

    const avail = Math.max((Number(lockedGems) || 0) - used, 0);
    setAvailableCycleGems(avail);

    // prefill max
    setAmount(avail > 0 ? String(avail) : '');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1) Fetch Open Cycle
      const { data: cycleData, error: cycleError } = await supabase
        .from('agency_withdrawal_cycles')
        .select('*')
        .eq('agency_user_id', user.id)
        .eq('status', 'open')
        .order('cycle_month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleError) throw cycleError;
      setCycle(cycleData);

      // Reset computed balances if no cycle
      if (!cycleData) {
        setUsedCycleGems(0);
        setAvailableCycleGems(0);
        setAmount('');
        setSnapshotRows([]);
        setRechargeAgents([]);
        return;
      }

      // ✅ 2) Compute AVAILABLE from cycle - used (NOT wallets)
      await fetchCycleUsage(cycleData.id, cycleData.locked_gems);

      // 3) Fetch Earnings Snapshot (same as before)
      const { data: snapshotData, error: snapshotError } = await supabase
        .from('agency_earnings_snapshots')
        .select('snapshot_json')
        .eq('agency_user_id', user.id)
        .order('cycle_month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshotError) throw snapshotError;

      if (snapshotData && snapshotData.snapshot_json?.by_user) {
        const rawRows = snapshotData.snapshot_json.by_user;
        const userIds = rawRows.map(r => r.user_id).filter(Boolean);

        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name, profile_id, avatar_url')
            .in('id', userIds);

          if (!profilesError && profiles) {
            const profilesMap = new Map(profiles.map(p => [p.id, p]));
            const enriched = rawRows.map(row => ({
              ...row,
              profile: profilesMap.get(row.user_id) || null
            }));
            setSnapshotRows(enriched);
          } else {
            setSnapshotRows(rawRows);
          }
        } else {
          setSnapshotRows(rawRows);
        }
      } else {
        setSnapshotRows([]);
      }

      // 4) Fetch Recharge Agents (RPC returns avatar_url بالفعل عندك)
      const { data: agentsData, error: agentsError } = await supabase.rpc('get_active_recharge_agents_for_user');
      if (!agentsError) setRechargeAgents(agentsData || []);
      else setRechargeAgents([]);

    } catch (err) {
      console.error('Error fetching withdrawal data:', err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل البيانات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cycle) return;

    const gemsAmount = parseInt(amount, 10);
    if (isNaN(gemsAmount) || gemsAmount <= 0) {
      toast({ title: "خطأ في القيمة", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
      return;
    }

    // ✅ Validate against cycle AVAILABLE (not wallet)
    if (gemsAmount > availableCycleGems) {
      toast({
        title: "رصيد غير كاف",
        description: "المبلغ المطلوب أكبر من الرصيد المتاح للسحب في هذه الدورة",
        variant: "destructive"
      });
      return;
    }

    if (!selectedAgentId) {
      toast({ title: "مطلوب وكيل شحن", description: "يرجى اختيار وكيل الشحن", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const splits = [{
        payout_method: 'recharge_agent',
        gems: gemsAmount,
        recharge_agent_id: parseInt(selectedAgentId, 10),
        note: 'سحب أرباح شهرية'
      }];

      const { data, error } = await supabase.rpc('create_gem_withdrawal_request', {
        p_splits: splits,
        p_note: 'سحب أرباح شهرية'
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);

      toast({
        title: "تم إرسال الطلب بنجاح",
        description: `تم إنشاء طلب سحب رقم #${data.request_id}`,
        className: "bg-green-50 border-green-200 text-green-800"
      });

      // Refresh data to show updated balance
      await fetchData();
      setSelectedAgentId('');

    } catch (err) {
      console.error('Withdrawal error:', err);
      toast({
        title: "فشل الطلب",
        description: err.message || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAgent = useMemo(
    () => rechargeAgents.find(a => String(a.id) === String(selectedAgentId)),
    [rechargeAgents, selectedAgentId]
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gray-50" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-gray-500">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  // Case 1: No Open Cycle
  if (!cycle) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5 ml-2" /> عودة
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">سحب الأرباح الشهرية</h1>
          </div>

          <Card className="border-t-4 border-t-yellow-500 shadow-sm">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <CardTitle className="text-xl">لا يوجد طلب سحب متاح حاليًا</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-gray-600">
              <p>سيتم فتح باب السحب بعد انتهاء الشهر الحالي وبدء الدورة المالية الجديدة.</p>
              <p className="mt-2 text-sm text-gray-500">يرجى التحقق مرة أخرى في بداية الشهر القادم.</p>
            </CardContent>
            <CardFooter className="justify-center pt-2 pb-6">
              <Button onClick={() => navigate('/agency-earnings')}>الذهاب إلى لوحة الوكالة</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const formattedDate = format(new Date(cycle.cycle_month), 'MMMM yyyy', { locale: ar });

  const isAvailableZero = (availableCycleGems || 0) <= 0;
  const locked = Number(cycle.locked_gems) || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="px-0 ml-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-3xl font-bold text-gray-900">سحب الأرباح الشهرية</h1>
            </div>
            <p className="text-gray-500 mr-9">إدارة وسحب أرباح الدورة الحالية</p>
          </div>

          <Badge variant="outline" className="w-fit px-4 py-1.5 bg-green-50 text-green-700 border-green-200 gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            دورة السحب مفتوحة: {formattedDate}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">الشهر المالي</CardTitle>
              <Calendar className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formattedDate}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">إجمالي الأرباح المحجوزة</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{locked.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">جوهرة</p>
            </CardContent>
          </Card>

          {/* ✅ The important card: AVAILABLE from cycle, not wallet */}
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700">الرصيد المتاح للسحب</CardTitle>
              <Wallet className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{(availableCycleGems || 0).toLocaleString()}</div>
              <p className="text-xs text-green-600/80 mt-1">جوهرة (المتبقي داخل الدورة)</p>
              {!!usedCycleGems && (
                <p className="text-[11px] text-gray-500 mt-2">
                  تم استخدام: {usedCycleGems.toLocaleString()} جوهرة من هذه الدورة
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Right Column: Withdrawal Form */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card className="border-t-4 border-t-primary shadow-sm h-full">
              <CardHeader>
                <CardTitle>طلب السحب</CardTitle>
                <CardDescription>قم بتقديم طلب لسحب أرباحك المتاحة الآن.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {isAvailableZero && (
                  <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    لا يوجد رصيد متاح للسحب في هذه الدورة (تم السحب/الحجز بالفعل).
                  </div>
                )}

                <div className="space-y-2">
                  <Label>طريقة السحب</Label>
                  <Select disabled defaultValue="recharge_agent">
                    <SelectTrigger className="bg-gray-50">
                      <SelectValue placeholder="اختر الطريقة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recharge_agent">وكيل شحن (Recharge Agent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>وكيل الشحن</Label>
                  <Select
                    value={selectedAgentId}
                    onValueChange={setSelectedAgentId}
                    disabled={submitting || isAvailableZero}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر وكيل الشحن..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rechargeAgents.length > 0 ? (
                        rechargeAgents.map(agent => (
                          <SelectItem key={agent.id} value={String(agent.id)}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 border border-gray-100">
                                <AvatarImage src={agent.avatar_url} />
                                <AvatarFallback className="bg-gray-100 text-gray-500 text-[10px]">
                                  {agent.name?.slice(0, 1) || 'A'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{agent.name}</span>
                              {agent.country_code && (
                                <span className="text-xs text-gray-400">({agent.country_code})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>لا يوجد وكلاء متاحين</SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Preview chosen agent */}
                  {selectedAgent && (
                    <div className="mt-2 p-2 rounded-md bg-gray-50 border flex items-center gap-2">
                      <Avatar className="h-8 w-8 border border-gray-100">
                        <AvatarImage src={selectedAgent.avatar_url} />
                        <AvatarFallback className="bg-gray-100 text-gray-500">
                          {selectedAgent.name?.slice(0, 1) || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <div className="font-semibold text-gray-900">{selectedAgent.name}</div>
                        {selectedAgent.country_code && <div className="text-xs text-gray-500">{selectedAgent.country_code}</div>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>المبلغ (جواهر)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={availableCycleGems || 0}
                      disabled={submitting || isAvailableZero}
                      className="pl-12 font-bold text-lg"
                    />
                    <div className="absolute left-3 top-2.5 text-sm text-gray-500 font-medium">GEM</div>
                  </div>
                  <p className="text-xs text-gray-500 text-left">
                    الحد الأقصى: {(availableCycleGems || 0).toLocaleString()}
                  </p>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-11"
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    isAvailableZero ||
                    !amount ||
                    parseInt(amount, 10) > (availableCycleGems || 0) ||
                    !selectedAgentId
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    'تأكيد طلب السحب'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Left Column: Detailed Report */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <Card className="h-full border-none shadow-none bg-transparent">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-xl font-bold text-gray-800">تفاصيل الأرباح</h2>
                <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border">
                  عدد العملاء: {snapshotRows.length}
                </span>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-center">ID</TableHead>
                      <TableHead className="text-left">الأرباح المحجوزة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshotRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-gray-500">
                          لا توجد بيانات متاحة لهذا الشهر
                        </TableCell>
                      </TableRow>
                    ) : (
                      snapshotRows.map((row, index) => (
                        <TableRow key={index} className="hover:bg-gray-50/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-gray-100">
                                <AvatarImage src={row.profile?.avatar_url} />
                                <AvatarFallback className="bg-gray-100 text-gray-400">
                                  {row.profile?.name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-gray-900">
                                {row.profile?.name || 'مستخدم غير معروف'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-gray-500 font-mono text-xs">
                            {row.profile?.profile_id || row.user_id?.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-left font-bold text-gray-700 dir-ltr">
                            {row.locked_gems?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}