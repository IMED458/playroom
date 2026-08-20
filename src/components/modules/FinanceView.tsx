import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { PaymentMethod, Transaction, TransactionSource, DailyClosure } from '../../types';
import {
  DollarSign,
  Banknote,
  CreditCard,
  Send,
  Sparkles,
  Calendar,
  Lock,
  Plus,
  RefreshCw,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  Edit2,
  Trash2,
  Filter,
  CheckCircle2,
  CalendarRange,
  ArrowUpDown
} from 'lucide-react';
import { sounds } from '../../lib/audio';

interface FinanceViewProps {
  onOpenDailyClose: () => void;
  onOpenTodaySales: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({ onOpenDailyClose, onOpenTodaySales }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TRANSACTIONS' | 'CLOSURES'>('OVERVIEW');
  
  // Date range filter
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [periodPreset, setPeriodPreset] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('TODAY');

  // Period / Today summary & Data
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);

  // Manual Transaction Form Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualMethod, setManualMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [manualSource, setManualSource] = useState<TransactionSource>(TransactionSource.MANUAL_ADJUSTMENT);
  const [manualNotes, setManualNotes] = useState<string>('');
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

  // Edit Transaction Modal (Admin control)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMethod, setEditMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  const applyPreset = (preset: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH') => {
    const now = new Date();
    setPeriodPreset(preset);

    if (preset === 'TODAY') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'THIS_WEEK') {
      const day = now.getDay() || 7; // Sunday is 7 in EU
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const isSingleDayToday = startDate === todayStr && endDate === todayStr;

      const [summaryRes, txRes, closeRes] = await Promise.all([
        isSingleDayToday
          ? apiRequest<any>('/finance/today-summary').catch(() => ({ summary: null }))
          : apiRequest<any>(`/finance/period-summary?startDate=${startDate}&endDate=${endDate}`).catch(() => ({ summary: null })),
        apiRequest<{ transactions: Transaction[] }>(`/finance/transactions?startDate=${startDate}&endDate=${endDate}&limit=200`).catch(() => ({ transactions: [] })),
        apiRequest<{ closures?: DailyClosure[]; dailyClosures?: DailyClosure[] }>('/finance/daily-closures').catch(() => ({ closures: [] as DailyClosure[], dailyClosures: [] as DailyClosure[] }))
      ]);

      setSummary(summaryRes?.summary || null);
      setTransactions(txRes?.transactions || []);
      setClosures(closeRes?.closures || closeRes?.dailyClosures || []);
    } catch (err) {
      console.error('Error fetching finance data:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, todayStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleManualTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(manualAmount);
    if (!amount || isNaN(amount)) return;

    setManualSubmitting(true);
    try {
      await apiRequest('/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          paymentMethod: manualMethod,
          source: manualSource,
          notes: manualNotes.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      setShowManualModal(false);
      setManualAmount('');
      setManualNotes('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'ოპერაციის დამატება ვერ მოხერხდა.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleOpenEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setEditAmount(String(t.amount));
    setEditMethod(t.paymentMethod);
    setEditNotes(t.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const amount = parseFloat(editAmount);
    if (isNaN(amount)) return;

    setEditSubmitting(true);
    try {
      await apiRequest(`/finance/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount,
          paymentMethod: editMethod,
          notes: editNotes.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      setEditingTransaction(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'ტრანზაქციის რედაქტირება ვერ მოხერხდა.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (t: Transaction) => {
    if (!confirm(`ნამდვილად გსურთ ${t.amount} ₾ ტრანზაქციის წაშლა?`)) return;
    try {
      await apiRequest(`/finance/transactions/${t.id}`, { method: 'DELETE' });
      sounds.playSuccessTone();
      fetchData();
    } catch (err: any) {
      alert(err.message || 'ტრანზაქციის წაშლა ვერ მოხერხდა.');
    }
  };

  // დღის დახურვის გაუქმება (ადმინი) — დღე ხელახლა დასახურავი ხდება
  const handleDeleteClosure = async (c: DailyClosure) => {
    if (!window.confirm(`${c.date}-ის დახურვა გაუქმდება და დღე ხელახლა დასახურავი გახდება. გავაგრძელოთ?`)) return;
    try {
      await apiRequest(`/finance/daily-closures/${c.id}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      window.alert(err.message || 'გაუქმება ვერ მოხერხდა.');
    }
  };

  const isToday = startDate === todayStr && endDate === todayStr;

  return (
    <div id="finance-view-container" className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>ფინანსები & სალარო (Cash Management & Reports)</span>
          </h2>
          <p className="text-xs text-slate-400">
            შემოსავლები, თარიღების ფილტრაცია, გადახდების რედაქტირება და დღის დახურვა
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-manual-income"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>თანხის შეტანა / კორექტირება</span>
          </button>

          <button
            id="btn-finance-daily-close"
            onClick={onOpenDailyClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>დღის დახურვა</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">პერიოდის ფილტრი:</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              id="btn-filter-today"
              onClick={() => applyPreset('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                periodPreset === 'TODAY'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              დღეს
            </button>
            <button
              id="btn-filter-yesterday"
              onClick={() => applyPreset('YESTERDAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                periodPreset === 'YESTERDAY'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              გუშინ
            </button>
            <button
              id="btn-filter-week"
              onClick={() => applyPreset('THIS_WEEK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                periodPreset === 'THIS_WEEK'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              მიმდინარე კვირა
            </button>
            <button
              id="btn-filter-month"
              onClick={() => applyPreset('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                periodPreset === 'THIS_MONTH'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              მიმდინარე თვე
            </button>
          </div>
        </div>

        {/* Date Inputs Form */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">დან:</span>
            <input
              id="input-filter-start-date"
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPeriodPreset('CUSTOM');
              }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">მდე:</span>
            <input
              id="input-filter-end-date"
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPeriodPreset('CUSTOM');
              }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-indigo-500"
            />
          </div>

          <button
            id="btn-refresh-finance"
            onClick={fetchData}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>განახლება</span>
          </button>

          <div className="ml-auto text-xs text-slate-400 font-medium">
            არჩეული პერიოდი: <strong className="text-white font-mono">{startDate}</strong> — <strong className="text-white font-mono">{endDate}</strong>
          </div>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Period Revenue */}
        <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl">
          <span className="text-xs font-semibold text-slate-400 block mb-1">
            {isToday ? 'დღის სრული შემოსავალი' : 'პერიოდის სრული შემოსავალი'}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {summary?.totalRevenue?.toFixed(2) || '0.00'} ₾
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary?.totalSessionsCount ?? summary?.sessionsCount ?? 0} სესია პერიოდში
          </span>
        </div>

        {/* Cash */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400">ნაღდი სალარო (Cash)</span>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {summary?.cash?.toFixed(2) || '0.00'} ₾
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">ფიზიკური ნაღდი ფული</span>
        </div>

        {/* Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400">ბარათი (POS Card)</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {summary?.card?.toFixed(2) || '0.00'} ₾
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">ტერმინალის ტრანზაქციები</span>
        </div>

        {/* Transfer & FitPass */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400">გადმორიცხვა & FitPass</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {summary?.transfer?.toFixed(2) || '0.00'} ₾
          </div>
          <span className="text-[11px] text-cyan-400/80 mt-1 block">
            FitPass: {summary?.fitpassNominal?.toFixed(2) || '0.00'} ₾ ({summary?.fitpassCount || 0})
          </span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          id="tab-finance-overview"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          მიმოხილვა & გადანაწილება
        </button>

        <button
          id="tab-finance-transactions"
          onClick={() => setActiveTab('TRANSACTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'TRANSACTIONS'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ტრანზაქციების ჟურნალი & რედაქტირება ({(transactions || []).length})
        </button>

        <button
          id="tab-finance-closures"
          onClick={() => setActiveTab('CLOSURES')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'CLOSURES'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          დღის დახურვის არქივი ({(closures || []).length})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">გადახდის მეთოდების გადანაწილება</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">ნაღდი ფული (CASH)</span>
                  <span className="font-mono text-emerald-400 font-bold">{summary?.cash?.toFixed(2) || '0.00'} ₾</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${summary?.totalRevenue > 0 ? (summary.cash / summary.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">საბანკო ბარათი (CARD)</span>
                  <span className="font-mono text-blue-400 font-bold">{summary?.card?.toFixed(2) || '0.00'} ₾</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${summary?.totalRevenue > 0 ? (summary.card / summary.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">გადმორიცხვა (TRANSFER)</span>
                  <span className="font-mono text-purple-400 font-bold">{summary?.transfer?.toFixed(2) || '0.00'} ₾</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full"
                    style={{ width: `${summary?.totalRevenue > 0 ? (summary.transfer / summary.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">სპეციალური შემოსავლები & შეღავათები</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">FitPass სესიები</span>
                <span className="text-base font-bold text-white font-mono">{summary?.fitpassCount || 0} სესია</span>
                <span className="text-[11px] text-cyan-400 block mt-0.5">ნომინალი: {summary?.fitpassNominal?.toFixed(2) || '0.00'} ₾</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ვაუჩერების გამოყენება</span>
                <span className="text-base font-bold text-white font-mono">{summary?.voucherCount || 0} ვაუჩერი</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ტურნირების შემოსავალი</span>
                <span className="text-base font-bold text-amber-400 font-mono">{summary?.tournamentRevenue?.toFixed(2) || '0.00'} ₾</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">გაცემული ფასდაკლებები</span>
                <span className="text-base font-bold text-emerald-400 font-mono">-{summary?.totalDiscounts?.toFixed(2) || '0.00'} ₾</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Transactions Table with Admin Edit & Delete */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="font-bold text-white text-sm">ტრანზაქციების რეესტრი</h3>
              <p className="text-xs text-slate-400">ადმინისტრატორს შეუძლია გადახდის თანხის, მეთოდის რედაქტირება ან წაშლა</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">სულ: {transactions.length} ჩანაწერი</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">თარიღი / დრო</th>
                  <th className="p-3">წყარო</th>
                  <th className="p-3">მეთოდი</th>
                  <th className="p-3">ოპერატორი</th>
                  <th className="p-3">შენიშვნა</th>
                  <th className="p-3 text-right">თანხა</th>
                  <th className="p-3 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {transactions.length > 0 ? (
                  transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono text-slate-400">
                        {new Date(t.createdAt).toLocaleString('ka-GE')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-200">
                          {t.source}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-200">{t.paymentMethod}</span>
                      </td>
                      <td className="p-3 text-slate-300">{t.createdByName || 'System'}</td>
                      <td className="p-3 text-slate-400 truncate max-w-xs">{t.notes || '—'}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                        {t.amount >= 0 ? `+${t.amount.toFixed(2)}` : t.amount.toFixed(2)} ₾
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-edit-tx-${t.id}`}
                            title="გადახდის რედაქტირება"
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 bg-slate-800 hover:bg-cyan-600/20 text-slate-400 hover:text-cyan-300 rounded-lg border border-slate-700 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-delete-tx-${t.id}`}
                            title="გადახდის წაშლა"
                            onClick={() => handleDeleteTransaction(t)}
                            className="p-1.5 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      ტრანზაქციები ამ პერიოდში არ მოიძებნა
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Closures Table */}
      {activeTab === 'CLOSURES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">თარიღი</th>
                  <th className="p-3">მოსალოდნელი ნაღდი</th>
                  <th className="p-3">ფაქტობრივი ნაღდი</th>
                  <th className="p-3">სხვაობა</th>
                  <th className="p-3">სრული შემოსავალი</th>
                  <th className="p-3">დახურა</th>
                  <th className="p-3">კომენტარი</th>
                  <th className="p-3 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(closures || []).length > 0 ? (
                  closures.map(c => {
                    const diff = c.cashDifference ?? (c as any).difference ?? 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-white">{c.date}</td>
                        <td className="p-3 font-mono text-slate-300">{(c.expectedCash ?? 0).toFixed(2)} ₾</td>
                        <td className="p-3 font-mono text-emerald-400 font-semibold">{(c.actualCash ?? 0).toFixed(2)} ₾</td>
                        <td className="p-3 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            diff === 0
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : diff > 0
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} ₾
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-white">{(c.totalRevenue ?? 0).toFixed(2)} ₾</td>
                        <td className="p-3 text-slate-300">{c.closedByName || '—'}</td>
                        <td className="p-3 text-slate-400">{c.comment || '—'}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteClosure(c)}
                            title="დახურვის გაუქმება"
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      დღის დახურვის ჩანაწერები არ მოიძებნა
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base">თანხის შეტანა / კორექტირება</h3>
              <button onClick={() => setShowManualModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleManualTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">თანხა (₾) *</label>
                <input
                  id="input-manual-amount"
                  type="number"
                  step="0.5"
                  required
                  placeholder="0.00"
                  value={manualAmount}
                  onChange={e => setManualAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm font-mono outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">მეთოდი *</label>
                <select
                  id="select-manual-method"
                  value={manualMethod}
                  onChange={e => setManualMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={PaymentMethod.CASH}>ნაღდი (CASH)</option>
                  <option value={PaymentMethod.CARD}>ბარათი (CARD)</option>
                  <option value={PaymentMethod.TRANSFER}>გადმორიცხვა (TRANSFER)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">ოპერაციის ტიპი *</label>
                <select
                  id="select-manual-source"
                  value={manualSource}
                  onChange={e => setManualSource(e.target.value as TransactionSource)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={TransactionSource.MANUAL_ADJUSTMENT}>ხელით კორექტირება (Adjustment)</option>
                  <option value={TransactionSource.PRODUCT_SALE}>ბარის / სასმელის გაყიდვა (Bar Sale)</option>
                  <option value={TransactionSource.TOURNAMENT_ENTRY}>ტურნირის შესატანი (Tournament)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">შენიშვნა</label>
                <input
                  id="input-manual-notes"
                  type="text"
                  placeholder="ოპერაციის მიზეზი..."
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  id="btn-submit-manual-tx"
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  {manualSubmitting ? 'ინახება...' : 'დამატება'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal (Admin Control) */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                გადახდის რედაქტირება (ID: {editingTransaction.id.slice(0, 8)})
              </h3>
              <button onClick={() => setEditingTransaction(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">თანხა (₾) *</label>
                <input
                  id="input-edit-tx-amount"
                  type="number"
                  step="0.5"
                  required
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm font-mono outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">გადახდის მეთოდი *</label>
                <select
                  id="select-edit-tx-method"
                  value={editMethod}
                  onChange={e => setEditMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={PaymentMethod.CASH}>ნაღდი (CASH)</option>
                  <option value={PaymentMethod.CARD}>ბარათი (CARD)</option>
                  <option value={PaymentMethod.TRANSFER}>გადმორიცხვა (TRANSFER)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">შენიშვნა / მიზეზი</label>
                <input
                  id="input-edit-tx-notes"
                  type="text"
                  placeholder="რატომ შეიცვალა ჩანაწერი..."
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  id="btn-submit-edit-tx"
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  {editSubmitting ? 'ინახება...' : 'შენახვა'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
