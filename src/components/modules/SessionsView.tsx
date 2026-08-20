import React, { useState, useEffect } from 'react';
import { DeviceCategory, PaymentMethod, PaymentStatus, Session, SessionStatus } from '../../types';
import { apiRequest } from '../../lib/api';
import {
  Clock,
  RefreshCw,
  AlertTriangle,
  FileText,
  X,
  Ban,
  Pencil,
  Trash2,
  Infinity as InfinityIcon,
  Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SessionsViewProps {
  onFinishSession: (session: Session) => void;
  onExtendSession: (session: Session, minutes: number) => void;
  onCancelSession: (session: Session) => void;
  onTerminateSession?: (session: Session) => void;
  onRefreshDashboard?: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  onFinishSession,
  onExtendSession,
  onCancelSession,
  onTerminateSession,
  onRefreshDashboard
}) => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('sessions.edit');
  const canDelete = hasPermission('sessions.delete');
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [isFitPass, setIsFitPass] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (status) params.append('status', status);
      if (paymentMethod) params.append('paymentMethod', paymentMethod);
      if (isFitPass) params.append('isFitPass', isFitPass);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('page', String(page));
      params.append('limit', '25');

      const data = await apiRequest<{ sessions: Session[]; pagination: any }>(`/sessions?${params.toString()}`);
      setSessions(data.sessions);
      setTotalPages(data.pagination.totalPages || 1);
      setTotalCount(data.pagination.total || 0);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [page, category, status, paymentMethod, isFitPass, startDate, endDate]);

  const handleDelete = async (session: Session) => {
    const confirmed = window.confirm(
      `სესია ${session.deviceName} (${new Date(session.startTime).toLocaleString('ka-GE')}) სამუდამოდ წაიშლება ` +
      'მასთან დაკავშირებულ ტრანზაქციასთან ერთად. გავაგრძელოთ?'
    );
    if (!confirmed) return;

    try {
      await apiRequest(`/sessions/${session.id}`, { method: 'DELETE' });
      fetchSessions();
      onRefreshDashboard?.();
    } catch (err: any) {
      window.alert(err.message || 'წაშლა ვერ მოხერხდა.');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSessions();
  };

  const getStatusBadge = (s: SessionStatus) => {
    switch (s) {
      case SessionStatus.ACTIVE:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">ACTIVE</span>;
      case SessionStatus.COMPLETED:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">COMPLETED</span>;
      case SessionStatus.CANCELLED:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400">{s}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span>სათამაშო სესიების ჟურნალი ({totalCount})</span>
            </h2>
            <p className="text-xs text-slate-400">აქტიური და ისტორიული სესიების დეტალური ჩამონათვალი</p>
          </div>

          <button
            onClick={() => fetchSessions()}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>განახლება</span>
          </button>
        </div>

        {/* Filters Form */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800">
          <input
            type="text"
            placeholder="ძებნა (მოწყობილობა, სახელი)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500"
          />

          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="">ყველა ზონა</option>
            <option value={DeviceCategory.PC}>PC</option>
            <option value={DeviceCategory.PLAYSTATION}>PlayStation</option>
            <option value={DeviceCategory.WHEEL}>Wheel</option>
          </select>

          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="">ყველა სტატუსი</option>
            <option value={SessionStatus.ACTIVE}>ACTIVE (აქტიური)</option>
            <option value={SessionStatus.COMPLETED}>COMPLETED (დასრულებული)</option>
            <option value={SessionStatus.CANCELLED}>CANCELLED (გაუქმებული)</option>
          </select>

          <select
            value={isFitPass}
            onChange={e => { setIsFitPass(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="">ყველა ტიპი</option>
            <option value="true">მხოლოდ FitPass</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-cyan-500"
            title="საწყისი თარიღი"
          />

          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            ძებნა
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">ID / თარიღი</th>
                <th className="p-3">მოწყობილობა</th>
                <th className="p-3">მოთამაშე</th>
                <th className="p-3">დრო (დაგეგმილი / ფაქტ.)</th>
                <th className="p-3">დამატებითი / ფასდაკლება</th>
                <th className="p-3">გადახდა / მეთოდი</th>
                <th className="p-3">სტატუსი</th>
                <th className="p-3 text-right">მოქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sessions.length > 0 ? (
                sessions.map(s => {
                  const start = new Date(s.startTime);
                  const isPrepaid = s.paymentStatus === 'PAID';
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <div className="font-mono text-slate-400 font-semibold">{s.id.substring(0, 8)}...</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {start.toLocaleDateString('ka-GE')} {start.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="p-3 font-semibold text-white">
                        <div>{s.deviceName}</div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{s.deviceCategory}</span>
                      </td>

                      <td className="p-3">
                        {s.customerName ? (
                          <div>
                            <span className="text-slate-200 font-medium">{s.customerName}</span>
                            {s.customerPhone && <span className="block text-[10px] text-slate-500 font-mono">{s.customerPhone}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1">
                          {s.isOpen && <InfinityIcon className="w-3 h-3 text-emerald-400" />}
                          <span>{s.plannedDurationMinutes} წთ</span>
                        </div>
                        {s.usedMinutes > 0 && (
                          <div className="text-[11px] text-cyan-400">ფაქტ: {s.usedMinutes} წთ</div>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {s.isFitPass && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">FitPass</span>
                          )}
                          {s.voucherCode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300">{s.voucherCode}</span>
                          )}
                          {s.extraControllersCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300">+{s.extraControllersCount} კონტრ.</span>
                          )}
                          {s.discountAmount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">-{s.discountAmount}₾</span>
                          )}
                          {!s.isFitPass && !s.voucherCode && s.extraControllersCount === 0 && s.discountAmount === 0 && (
                            <span className="text-slate-500">—</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-emerald-400 font-mono text-sm">
                          {s.isFitPass ? '0.00 ₾' : `${s.customerPaidAmount.toFixed(2)} ₾`}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.paymentMethod} • <span className={isPrepaid ? 'text-emerald-400' : 'text-amber-400'}>{s.paymentStatus}</span>
                        </div>
                        {!!s.unpaidAmount && s.unpaidAmount > 0 && (
                          <div className="text-[10px] text-red-400 font-mono">დავალიანება: {s.unpaidAmount.toFixed(2)} ₾</div>
                        )}
                      </td>

                      <td className="p-3">{getStatusBadge(s.status)}</td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === SessionStatus.ACTIVE && (
                            <>
                              <button
                                type="button"
                                onClick={() => onFinishSession(s)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                              >
                                დასრულება
                              </button>
                              {onTerminateSession && (
                                <button
                                  type="button"
                                  onClick={() => onTerminateSession(s)}
                                  className="p-1 rounded-lg bg-orange-950/40 hover:bg-orange-900/60 border border-orange-500/40 text-orange-300 transition cursor-pointer"
                                  title="თამაშის შეწყვეტა"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onCancelSession(s)}
                                className="p-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 transition cursor-pointer"
                                title="გაუქმება"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedSession(s)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                            title="დეტალები"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditSession(s)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition cursor-pointer"
                              title="რედაქტირება"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 transition cursor-pointer"
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
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    სესიები ვერ მოიძებნა
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>გვერდი {page} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                წინა
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                შემდეგი
              </button>
            </div>
          </div>
        )}
      </div>

      {/* სესიის რედაქტირება (ადმინი) */}
      {editSession && (
        <EditSessionModal
          session={editSession}
          onClose={() => setEditSession(null)}
          onSaved={() => {
            setEditSession(null);
            fetchSessions();
            onRefreshDashboard?.();
          }}
        />
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                <h3 className="font-bold text-white text-base">სესიის სრული დეტალები</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedSession.id}</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">მოწყობილობა</span>
                  <span className="font-bold text-white text-sm">{selectedSession.deviceName}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">ოპერატორი</span>
                  <span className="font-bold text-white text-sm">{selectedSession.operatorName}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">დაწყების დრო:</span>
                  <span className="font-mono text-white">{new Date(selectedSession.startTime).toLocaleString('ka-GE')}</span>
                </div>
                {selectedSession.actualEndTime && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">დასრულების დრო:</span>
                    <span className="font-mono text-white">{new Date(selectedSession.actualEndTime).toLocaleString('ka-GE')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">ხანგრძლივობა:</span>
                  <span className="font-mono text-white">{selectedSession.plannedDurationMinutes} წთ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">საბაზისო ფასი:</span>
                  <span className="font-mono text-white">{selectedSession.basePrice.toFixed(2)} ₾</span>
                </div>
                {selectedSession.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>ფასდაკლება ({selectedSession.discountName || 'Manual'}):</span>
                    <span className="font-mono">-{selectedSession.discountAmount.toFixed(2)} ₾</span>
                  </div>
                )}
                {selectedSession.extraControllersPrice > 0 && (
                  <div className="flex justify-between text-purple-400">
                    <span>დამატებითი კონტროლერები:</span>
                    <span className="font-mono">+{selectedSession.extraControllersPrice.toFixed(2)} ₾</span>
                  </div>
                )}
                {selectedSession.voucherCoveredAmount > 0 && (
                  <div className="flex justify-between text-purple-300">
                    <span>ვაუჩერი ({selectedSession.voucherCode}):</span>
                    <span className="font-mono">-{selectedSession.voucherCoveredAmount.toFixed(2)} ₾</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                  <span className="text-white">კლიენტის გადახდილი თანხა:</span>
                  <span className="text-emerald-400 font-mono">{selectedSession.customerPaidAmount.toFixed(2)} ₾</span>
                </div>
              </div>

              {selectedSession.comment && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">შენიშვნა</span>
                  <p className="text-slate-300">{selectedSession.comment}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** სესიის სრული რედაქტირება — თანხების, დროისა და სტატუსის ჩათვლით */
const EditSessionModal: React.FC<{
  session: Session;
  onClose: () => void;
  onSaved: () => void;
}> = ({ session, onClose, onSaved }) => {
  const [form, setForm] = useState({
    plannedDurationMinutes: session.plannedDurationMinutes,
    usedMinutes: session.usedMinutes,
    hourlyRate: session.hourlyRate,
    basePrice: session.basePrice,
    discountAmount: session.discountAmount,
    finalPrice: session.finalPrice,
    customerPaidAmount: session.customerPaidAmount,
    unpaidAmount: session.unpaidAmount || 0,
    paymentMethod: session.paymentMethod,
    paymentStatus: session.paymentStatus,
    status: session.status,
    customerName: session.customerName || '',
    customerPhone: session.customerPhone || '',
    comment: session.comment || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/sessions/${session.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          plannedDurationMinutes: Number(form.plannedDurationMinutes),
          usedMinutes: Number(form.usedMinutes),
          hourlyRate: Number(form.hourlyRate),
          basePrice: Number(form.basePrice),
          discountAmount: Number(form.discountAmount),
          finalPrice: Number(form.finalPrice),
          customerPaidAmount: Number(form.customerPaidAmount),
          unpaidAmount: Number(form.unpaidAmount)
        })
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'შენახვა ვერ მოხერხდა.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type: string = 'text') => (
    <div>
      <label className="block text-[10px] text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={form[key] as any}
        onChange={e => update(key, e.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-amber-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-amber-950/20">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-400" />
              <span>სესიის რედაქტირება</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">{session.deviceName} • {session.id}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{error}</div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {field('ხანგრძლივობა (წთ)', 'plannedDurationMinutes', 'number')}
            {field('ფაქტობრივი (წთ)', 'usedMinutes', 'number')}
            {field('ტარიფი ₾/სთ', 'hourlyRate', 'number')}
            {field('საბაზისო ფასი', 'basePrice', 'number')}
            {field('ფასდაკლება', 'discountAmount', 'number')}
            {field('საბოლოო ფასი', 'finalPrice', 'number')}
            {field('გადახდილი', 'customerPaidAmount', 'number')}
            {field('გადაუხდელი', 'unpaidAmount', 'number')}

            <div>
              <label className="block text-[10px] text-slate-500 mb-1">გადახდის მეთოდი</label>
              <select
                value={form.paymentMethod}
                onChange={e => update('paymentMethod', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-amber-500 cursor-pointer"
              >
                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1">გადახდის სტატუსი</label>
              <select
                value={form.paymentStatus}
                onChange={e => update('paymentStatus', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-amber-500 cursor-pointer"
              >
                {Object.values(PaymentStatus).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1">სესიის სტატუსი</label>
              <select
                value={form.status}
                onChange={e => update('status', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-amber-500 cursor-pointer"
              >
                {Object.values(SessionStatus).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('კლიენტი', 'customerName')}
            {field('ტელეფონი', 'customerPhone')}
            {field('კომენტარი', 'comment')}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'ინახება...' : 'ცვლილებების შენახვა'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
