import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { Attendance, Employee, RoleName } from '../../types';
import {
  Users,
  UserCheck,
  Percent,
  Plus,
  Calendar,
  Wallet,
  Trash2,
  Pencil,
  X,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Coins
} from 'lucide-react';
import { sounds } from '../../lib/audio';
import { useAuth } from '../../context/AuthContext';

interface PayoutPreviewRow {
  employeeId: string;
  employeeName: string;
  role: string;
  percent: number;
  workedHours: number;
  amount: number;
  saved: boolean;
  payoutId?: string;
  status: string;
}

interface PayoutsResponse {
  date: string;
  enabled: boolean;
  revenue: { base: number; totalRevenue: number; cash: number; mode: string };
  onlyWorkedShifts: boolean;
  defaultPercent: number;
  totalPercent: number;
  totalAmount: number;
  preview: PayoutPreviewRow[];
  payouts: {
    id: string;
    date: string;
    employeeName: string;
    revenueBase: number;
    percent: number;
    amount: number;
    status: string;
    paidAt?: string;
    paymentMethod?: string;
  }[];
}

const todayStr = () => new Date().toISOString().split('T')[0];

const emptyEmployee = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  username: '',
  role: RoleName.OPERATOR as string,
  revenuePercent: 5,
  hourlySalary: 0,
  status: 'ACTIVE',
  notes: ''
};

export const StaffPayrollView: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEditStaff = hasPermission('staff.edit');
  const canDeleteStaff = hasPermission('staff.delete');
  const canEditPayroll = hasPermission('payroll.edit');

  const [activeTab, setActiveTab] = useState<'PAYOUTS' | 'EMPLOYEES' | 'ATTENDANCE'>('PAYOUTS');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payoutDate, setPayoutDate] = useState<string>(todayStr());
  const [payouts, setPayouts] = useState<PayoutsResponse | null>(null);
  const [history, setHistory] = useState<PayoutsResponse['payouts']>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ცალკეული პროცენტების ლოკალური რედაქტირება
  const [percentOverrides, setPercentOverrides] = useState<Record<string, number>>({});

  const [empModal, setEmpModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);

  const notify = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const fetchEmployees = useCallback(async () => {
    const res = await apiRequest<{ employees: Employee[] }>('/employees').catch(() => ({ employees: [] }));
    setEmployees(res.employees || []);
  }, []);

  const fetchAttendance = useCallback(async () => {
    const res = await apiRequest<{ attendance: Attendance[] }>('/employees/attendance').catch(() => ({ attendance: [] }));
    setAttendance(res.attendance || []);
  }, []);

  const fetchPayouts = useCallback(async () => {
    const res = await apiRequest<PayoutsResponse>(`/employees/payouts?date=${payoutDate}`).catch(() => null);
    setPayouts(res);
    setPercentOverrides({});
  }, [payoutDate]);

  const fetchHistory = useCallback(async () => {
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const res = await apiRequest<{ payouts: PayoutsResponse['payouts'] }>(
      `/employees/payouts?startDate=${from}&endDate=${todayStr()}`
    ).catch(() => ({ payouts: [] }));
    setHistory(res.payouts || []);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchEmployees(), fetchAttendance(), fetchPayouts(), fetchHistory()]);
    setLoading(false);
  }, [fetchEmployees, fetchAttendance, fetchPayouts, fetchHistory]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ---------- პერსონალი ----------
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empModal) return;
    setSubmitting(true);
    try {
      const body = {
        ...empModal.data,
        revenuePercent: Number(empModal.data.revenuePercent) || 0,
        hourlySalary: Number(empModal.data.hourlySalary) || 0
      };

      if (empModal.mode === 'create') {
        await apiRequest('/employees', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await apiRequest(`/employees/${empModal.data.id}`, { method: 'PUT', body: JSON.stringify(body) });
      }

      sounds.playSuccessTone();
      setEmpModal(null);
      notify('ok', 'თანამშრომლის მონაცემები შენახულია.');
      await fetchEmployees();
      await fetchPayouts();
    } catch (err: any) {
      notify('err', err.message || 'შენახვა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!window.confirm(`წაიშალოს ${emp.firstName} ${emp.lastName}? ეს მოქმედება შეუქცევადია.`)) return;
    try {
      await apiRequest(`/employees/${emp.id}`, { method: 'DELETE' });
      notify('ok', 'თანამშრომელი წაიშალა.');
      await fetchEmployees();
      await fetchPayouts();
    } catch (err: any) {
      notify('err', err.message || 'წაშლა ვერ მოხერხდა.');
    }
  };

  // ---------- დღიური ანაზღაურება ----------
  const handleGenerate = async () => {
    if (!payouts) return;
    setSubmitting(true);
    try {
      const entries = payouts.preview.map(p => ({
        employeeId: p.employeeId,
        percent: percentOverrides[p.employeeId] ?? p.percent
      }));

      const res = await apiRequest<{ message: string }>('/employees/payouts/generate', {
        method: 'POST',
        body: JSON.stringify({ date: payoutDate, entries })
      });

      sounds.playSuccessTone();
      notify('ok', res.message);
      await fetchPayouts();
      await fetchHistory();
    } catch (err: any) {
      notify('err', err.message || 'განაწილება ვერ დაფიქსირდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (payoutId: string) => {
    try {
      const res = await apiRequest<{ message: string }>(`/employees/payouts/${payoutId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'CASH' })
      });
      sounds.playSuccessTone();
      notify('ok', res.message);
      await fetchPayouts();
      await fetchHistory();
    } catch (err: any) {
      notify('err', err.message || 'გაცემა ვერ მოხერხდა.');
    }
  };

  const handleDeletePayout = async (payoutId: string) => {
    if (!window.confirm('ანაზღაურების ჩანაწერი წაიშლება. გავაგრძელოთ?')) return;
    try {
      await apiRequest(`/employees/payouts/${payoutId}`, { method: 'DELETE' });
      notify('ok', 'ჩანაწერი წაიშალა.');
      await fetchPayouts();
      await fetchHistory();
    } catch (err: any) {
      notify('err', err.message || 'წაშლა ვერ მოხერხდა.');
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!window.confirm('დასწრების ჩანაწერი წაიშლება. გავაგრძელოთ?')) return;
    try {
      await apiRequest(`/employees/attendance/${id}`, { method: 'DELETE' });
      notify('ok', 'ჩანაწერი წაიშალა.');
      await fetchAttendance();
    } catch (err: any) {
      notify('err', err.message || 'წაშლა ვერ მოხერხდა.');
    }
  };

  const previewTotal = payouts
    ? payouts.preview.reduce((sum, p) => {
        const percent = percentOverrides[p.employeeId] ?? p.percent;
        return sum + (payouts.revenue.base * percent) / 100;
      }, 0)
    : 0;
  const previewPercent = payouts
    ? payouts.preview.reduce((sum, p) => sum + (percentOverrides[p.employeeId] ?? p.percent), 0)
    : 0;

  const TABS = [
    { id: 'PAYOUTS' as const, label: 'დღიური ანაზღაურება', icon: Percent },
    { id: 'EMPLOYEES' as const, label: 'პერსონალი', icon: Users },
    { id: 'ATTENDANCE' as const, label: 'დასწრება / ცვლები', icon: UserCheck }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>პერსონალი & ანაზღაურება</span>
          </h2>
          <p className="text-xs text-slate-400">
            პერსონალი იღებს დღის შემოსავლის კუთვნილ პროცენტს — საათობრივი ხელფასის ნაცვლად
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          className="self-start flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>განახლება</span>
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
          message.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ============ დღიური ანაზღაურება ============ */}
      {activeTab === 'PAYOUTS' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">თარიღი</label>
                <input
                  type="date"
                  value={payoutDate}
                  onChange={e => setPayoutDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-cyan-500 cursor-pointer"
                />
              </div>

              {payouts && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">დღის ბაზა</div>
                    <div className="text-base font-black text-emerald-400 font-mono">
                      {payouts.revenue.base.toFixed(2)} ₾
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {payouts.revenue.mode === 'CASH_ONLY' ? 'მხოლოდ ნაღდი' : 'სრული შემოსავალი'}
                    </div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">ჯამური %</div>
                    <div className="text-base font-black text-cyan-400 font-mono">{previewPercent.toFixed(1)}%</div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">გასაცემი</div>
                    <div className="text-base font-black text-amber-400 font-mono">{previewTotal.toFixed(2)} ₾</div>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 min-w-[640px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">თანამშრომელი</th>
                    <th className="p-3">როლი</th>
                    <th className="p-3 text-center">ნამუშევარი</th>
                    <th className="p-3 text-center">პროცენტი</th>
                    <th className="p-3 text-right">თანხა</th>
                    <th className="p-3 text-center">სტატუსი</th>
                    <th className="p-3 text-right">მოქმედება</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payouts && payouts.preview.length > 0 ? (
                    payouts.preview.map(row => {
                      const percent = percentOverrides[row.employeeId] ?? row.percent;
                      const amount = row.saved ? row.amount : (payouts.revenue.base * percent) / 100;
                      return (
                        <tr key={row.employeeId} className="hover:bg-slate-800/40">
                          <td className="p-3 font-semibold text-white">{row.employeeName}</td>
                          <td className="p-3 text-[11px] font-mono text-slate-400">{row.role}</td>
                          <td className="p-3 text-center font-mono">{row.workedHours.toFixed(1)} სთ</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                disabled={row.saved || !canEditPayroll}
                                value={percent}
                                onChange={e => setPercentOverrides(prev => ({
                                  ...prev,
                                  [row.employeeId]: Math.max(0, parseFloat(e.target.value) || 0)
                                }))}
                                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs font-mono text-center outline-none focus:border-cyan-500 disabled:opacity-60"
                              />
                              <span className="text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            {amount.toFixed(2)} ₾
                          </td>
                          <td className="p-3 text-center">
                            {row.status === 'PAID' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                გაცემული
                              </span>
                            ) : row.saved ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                დასაფიქსირებელი
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                                გათვლა
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {row.saved && row.status !== 'PAID' && canEditPayroll && (
                                <button
                                  type="button"
                                  onClick={() => row.payoutId && handlePay(row.payoutId)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  გაცემა
                                </button>
                              )}
                              {row.saved && canEditPayroll && (
                                <button
                                  type="button"
                                  onClick={() => row.payoutId && handleDeletePayout(row.payoutId)}
                                  className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 cursor-pointer"
                                  title="წაშლა"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        {loading ? 'იტვირთება...' : 'ამ დღისთვის ანაზღაურებადი პერსონალი ვერ მოიძებნა'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {canEditPayroll && payouts && payouts.preview.length > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px] text-slate-500">
                  „დაფიქსირება" შეინახავს დღის განაწილებას. გაცემული თანხა დღის დახურვისას სალაროდან გამოაკლდება.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-600/25 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  <span>{submitting ? 'მუშავდება...' : 'დღის განაწილების დაფიქსირება'}</span>
                </button>
              </div>
            )}
          </div>

          {/* ისტორია */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>ბოლო 30 დღის ანაზღაურებები</span>
            </h3>

            <div className="border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 min-w-[560px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">თარიღი</th>
                    <th className="p-3">თანამშრომელი</th>
                    <th className="p-3 text-right">დღის ბაზა</th>
                    <th className="p-3 text-center">%</th>
                    <th className="p-3 text-right">თანხა</th>
                    <th className="p-3 text-center">სტატუსი</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {history.length > 0 ? history.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{p.date}</td>
                      <td className="p-3 font-semibold text-white">{p.employeeName}</td>
                      <td className="p-3 text-right font-mono text-slate-400">{p.revenueBase.toFixed(2)} ₾</td>
                      <td className="p-3 text-center font-mono">{p.percent}%</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">{p.amount.toFixed(2)} ₾</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {p.status === 'PAID' ? 'გაცემული' : 'მოლოდინში'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">ჩანაწერები არ არის</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ პერსონალი ============ */}
      {activeTab === 'EMPLOYEES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">თანამშრომლების სია ({employees.length})</h3>
            {canEditStaff && (
              <button
                type="button"
                onClick={() => setEmpModal({ mode: 'create', data: { ...emptyEmployee } })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ახალი თანამშრომელი</span>
              </button>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 min-w-[720px]">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">სახელი</th>
                  <th className="p-3">როლი</th>
                  <th className="p-3">კონტაქტი</th>
                  <th className="p-3 text-center">დღის %</th>
                  <th className="p-3 text-center">სტატუსი</th>
                  <th className="p-3 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {employees.length > 0 ? employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">
                      {emp.firstName} {emp.lastName}
                      <span className="block text-[10px] text-slate-500 font-mono">{emp.username}</span>
                    </td>
                    <td className="p-3 text-[11px] font-mono text-slate-400">{emp.role}</td>
                    <td className="p-3">
                      <div className="font-mono text-[11px]">{emp.phone}</div>
                      <div className="text-[10px] text-slate-500">{emp.email}</div>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-cyan-400">
                      {(emp.revenuePercent ?? 0).toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        emp.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {emp.status === 'ACTIVE' ? 'აქტიური' : 'არააქტიური'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEditStaff && (
                          <button
                            type="button"
                            onClick={() => setEmpModal({ mode: 'edit', data: { ...emp } })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                            title="რედაქტირება"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteStaff && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp)}
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 cursor-pointer"
                            title="წაშლა"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">თანამშრომლები არ არის</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ დასწრება ============ */}
      {activeTab === 'ATTENDANCE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>ცვლების ჟურნალი</span>
          </h3>

          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 min-w-[620px]">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">თარიღი</th>
                  <th className="p-3">თანამშრომელი</th>
                  <th className="p-3">ცვლა</th>
                  <th className="p-3">დაწყება</th>
                  <th className="p-3">დასრულება</th>
                  <th className="p-3 text-center">საათები</th>
                  <th className="p-3 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {attendance.length > 0 ? attendance.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">{a.date}</td>
                    <td className="p-3 font-semibold text-white">{a.employeeName}</td>
                    <td className="p-3 text-slate-400">{a.shiftName || '—'}</td>
                    <td className="p-3 font-mono">
                      {new Date(a.startTime).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-mono">
                      {a.endTime
                        ? new Date(a.endTime).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })
                        : <span className="text-emerald-400">მიმდინარე</span>}
                    </td>
                    <td className="p-3 text-center font-mono">{a.workedHours.toFixed(1)}</td>
                    <td className="p-3 text-right">
                      {canEditStaff && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttendance(a.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 cursor-pointer"
                          title="წაშლა"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">ჩანაწერები არ არის</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* თანამშრომლის მოდალი */}
      {empModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-bold text-white text-base">
                {empModal.mode === 'create' ? 'ახალი თანამშრომელი' : 'თანამშრომლის რედაქტირება'}
              </h3>
              <button type="button" onClick={() => setEmpModal(null)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'firstName', label: 'სახელი *' },
                  { key: 'lastName', label: 'გვარი *' },
                  { key: 'phone', label: 'ტელეფონი *' },
                  { key: 'email', label: 'Email *' }
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[10px] text-slate-500 mb-1">{f.label}</label>
                    <input
                      type="text"
                      required
                      value={empModal.data[f.key] || ''}
                      onChange={e => setEmpModal({ ...empModal, data: { ...empModal.data, [f.key]: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500"
                    />
                  </div>
                ))}

                {empModal.mode === 'create' && (
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">მომხმარებელი (username) *</label>
                    <input
                      type="text"
                      required
                      value={empModal.data.username || ''}
                      onChange={e => setEmpModal({ ...empModal, data: { ...empModal.data, username: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">როლი</label>
                  <select
                    value={empModal.data.role}
                    onChange={e => setEmpModal({ ...empModal, data: { ...empModal.data, role: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {Object.values(RoleName).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">დღის შემოსავლის % *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={empModal.data.revenuePercent}
                    onChange={e => setEmpModal({ ...empModal, data: { ...empModal.data, revenuePercent: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">სტატუსი</label>
                  <select
                    value={empModal.data.status}
                    onChange={e => setEmpModal({ ...empModal, data: { ...empModal.data, status: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="ACTIVE">აქტიური</option>
                    <option value="INACTIVE">არააქტიური</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">შენიშვნა</label>
                <input
                  type="text"
                  value={empModal.data.notes || ''}
                  onChange={e => setEmpModal({ ...empModal, data: { ...empModal.data, notes: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmpModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'ინახება...' : 'შენახვა'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
