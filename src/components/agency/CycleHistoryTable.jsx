import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { History, CheckCircle2, Lock, Filter, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CycleHistoryTable({ cycles = [] }) {
  const { t } = useTranslation('common');
  const { language } = useLanguage();
  const [filter, setFilter] = useState('all');

  // Filter cycles based on selection
  const filteredCycles = cycles.filter(cycle => {
    if (filter === 'all') return true;
    return cycle.status === filter;
  });

  const getStatusBadge = (status) => {
    if (status === 'open') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 flex w-fit items-center gap-1">
           <CheckCircle2 className="w-3 h-3" />
           {t('agency.cycle_history.open')}
        </Badge>
      );
    }
    if (status === 'closed') {
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100 flex w-fit items-center gap-1">
           <Lock className="w-3 h-3" />
           {t('agency.cycle_history.closed')}
        </Badge>
      );
    }
    return (
        <Badge variant="destructive" className="flex w-fit items-center gap-1">
           <XCircle className="w-3 h-3" />
           {t('agency.cycle_history.invalid')}
        </Badge>
    );
  };

  const getDateLocale = () => {
    return language === 'ar' ? ar : enUS;
  };

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
         <div>
            <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                {t('agency.cycle_history.title')}
            </CardTitle>
            <CardDescription>{t('agency.cycle_history.description')}</CardDescription>
         </div>
         <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                    <SelectValue placeholder={t('agency.cycle_history.filter_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('agency.cycle_history.all')}</SelectItem>
                    <SelectItem value="open">{t('agency.cycle_history.open')}</SelectItem>
                    <SelectItem value="closed">{t('agency.cycle_history.closed')}</SelectItem>
                </SelectContent>
            </Select>
         </div>
      </CardHeader>
      <CardContent>
         <div className="rounded-md border overflow-hidden">
            <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow>
                        <TableHead className={language === 'ar' ? "text-right" : "text-left"}>{t('agency.cycle_history.month')}</TableHead>
                        <TableHead className="text-center">{t('agency.cycle_history.status')}</TableHead>
                        <TableHead className="text-center">{t('agency.cycle_history.locked_amount')}</TableHead>
                        <TableHead className="text-center">{t('agency.cycle_history.opened_at')}</TableHead>
                        <TableHead className={language === 'ar' ? "text-left" : "text-left"}>{t('agency.cycle_history.notes')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredCycles.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                                {t('agency.cycle_history.no_cycles')}
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredCycles.map((cycle) => (
                            <TableRow key={cycle.id} className="hover:bg-gray-50/50">
                                <TableCell className="font-medium">
                                    {format(new Date(cycle.cycle_month), 'MMMM yyyy', { locale: getDateLocale() })}
                                </TableCell>
                                <TableCell className="flex justify-center">
                                    {getStatusBadge(cycle.status)}
                                </TableCell>
                                <TableCell className="text-center font-bold text-indigo-600 dir-ltr">
                                    {cycle.locked_gems?.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-center text-gray-500 text-sm">
                                    {cycle.opened_at ? format(new Date(cycle.opened_at), 'dd/MM/yyyy') : '-'}
                                </TableCell>
                                <TableCell className="text-left text-gray-500 text-sm max-w-[200px] truncate">
                                    {cycle.note || '-'}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
         </div>
      </CardContent>
    </Card>
  );
}