import React, { useState, useEffect } from 'react';
import { Reservation, ReservationStatus, Device } from '../../types';
import { apiRequest } from '../../lib/api';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Gamepad2,
  Plus,
  Play,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Tv,
  Monitor,
  Disc
} from 'lucide-react';
import { sounds } from '../../lib/audio';

interface BookingsViewProps {
  devices: Device[];
  onOpenCreateModal: () => void;
  onSessionStarted?: () => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  devices,
  onOpenCreateModal,
  onSessionStarted
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('TODAY');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      let query = '';
      if (dateFilter === 'TODAY') {
        const today = new Date().toISOString().slice(0, 10);
        query = `?date=${today}`;
      }
      const data = await apiRequest<{ reservations: Reservation[] }>(`/reservations${query}`);
      setReservations(data?.reservations || []);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'ჯავშნების ჩატვირთვა ვერ მოხერხდა' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [dateFilter]);

  const handleConvertToSession = async (res: Reservation) => {
    setConvertingId(res.id);
    setMsg(null);
    try {
      await apiRequest(`/reservations/${res.id}/convert-to-session`, {
        method: 'POST',
        body: JSON.stringify({
          durationMinutes: 60
        })
      });
      sounds.playSuccessTone();
      setMsg({ type: 'success', text: `სესია წარმატებით დაიწყო (${res.deviceName} - ${res.customerName})!` });
      await fetchReservations();
      if (onSessionStarted) {
        onSessionStarted();
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'სესიის დაწყება ვერ მოხერხდა' });
    } finally {
      setConvertingId(null);
    }
  };

  const handleCancelReservation = async (id: string) => {
    if (!confirm('ნამდვილად გსურთ ამ ჯავშნის გაუქმება?')) return;
    try {
      await apiRequest(`/reservations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: ReservationStatus.CANCELLED })
      });
      sounds.playSuccessTone();
      setMsg({ type: 'success', text: 'ჯავშანი გაუქმდა.' });
      await fetchReservations();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'სტატუსის შეცვლა ვერ მოხერხდა' });
    }
  };

  const filtered = reservations.filter(r => {
    const matchSearch =
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.customerPhone.includes(search) ||
      r.deviceName.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayReservations = reservations.filter(r => r.startTime.startsWith(todayStr));
  const activeConfirmed = reservations.filter(r => r.status === ReservationStatus.CONFIRMED);
  const totalDeposits = reservations.reduce((sum, r) => sum + (r.depositAmount || 0), 0);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PC':
        return <Monitor className="w-4 h-4 text-cyan-400" />;
      case 'PLAYSTATION':
        return <Tv className="w-4 h-4 text-indigo-400" />;
      case 'WHEEL':
        return <Disc className="w-4 h-4 text-amber-400" />;
      default:
        return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month} ${hours}:${mins}`;
    } catch {
      return isoString;
    }
  };

  const formatTimeOnly = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${mins}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-amber-400" />
            <span>წინასწარი ჯავშნების მართვა</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            მოწყობილობების დაჯავშნა მომხმარებლისთვის, დეპოზიტები და 1-Click სესიის გაშვება
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReservations}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="განახლება"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ახალი ჯავშანი</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">დღევანდელი ჯავშნები</p>
            <h3 className="text-xl font-extrabold text-white mt-1">{todayReservations.length}</h3>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">აქტიური / მომლოდინე</p>
            <h3 className="text-xl font-extrabold text-emerald-400 mt-1">{activeConfirmed.length}</h3>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">მიღებული დეპოზიტები (ბე)</p>
            <h3 className="text-xl font-extrabold text-cyan-400 mt-1">{totalDeposits.toFixed(2)} ₾</h3>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ძებნა: სახელი, ნომერი, მოწყობილობა..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDateFilter('TODAY')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                dateFilter === 'TODAY'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              დღევანდელი
            </button>
            <button
              onClick={() => setDateFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                dateFilter === 'ALL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ყველა თარიღი
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">ყველა სტატუსი</option>
            <option value={ReservationStatus.CONFIRMED}>დადასტურებული</option>
            <option value={ReservationStatus.CONVERTED}>სესია დაწყებულია</option>
            <option value={ReservationStatus.CANCELLED}>გაუქმებული</option>
          </select>
        </div>
      </div>

      {/* Reservations List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">ჯავშნები იტვირთება...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-300">ჯავშნები ვერ მოიძებნა</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            ამ ფილტრით ჯავშნები არ არის რეგისტრირებული. შეგიძლიათ დაამატოთ ახალი ჯავშანი.
          </p>
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>ჯავშნის დამატება</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(res => {
            const isConfirmed = res.status === ReservationStatus.CONFIRMED;
            const isConverted = res.status === ReservationStatus.CONVERTED;
            const isCancelled = res.status === ReservationStatus.CANCELLED;

            return (
              <div
                key={res.id}
                className={`bg-slate-900/90 border rounded-2xl p-4 flex flex-col justify-between transition shadow-lg ${
                  isConfirmed
                    ? 'border-amber-500/30 hover:border-amber-500/60'
                    : isConverted
                    ? 'border-emerald-500/30 opacity-75'
                    : 'border-slate-800 opacity-60'
                }`}
              >
                <div>
                  {/* Card Header: Device & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                        {getCategoryIcon(res.deviceCategory)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{res.deviceName}</h4>
                        <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                          {res.deviceCategory}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                        isConfirmed
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : isConverted
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-300 border-red-500/30'
                      }`}
                    >
                      {isConfirmed ? 'დადასტურებული' : isConverted ? 'სესია დაწყებულია' : 'გაუქმებული'}
                    </span>
                  </div>

                  {/* Time Badge */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>დაწყება:</span>
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {formatDateTime(res.startTime)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">დასრულება:</span>
                      <span className="font-mono text-slate-300">
                        {res.endTime ? formatTimeOnly(res.endTime) : 'ღია / დროის გარეშე'}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex items-center gap-2 text-white">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{res.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${res.customerPhone}`} className="hover:text-amber-400 transition">
                        {res.customerPhone}
                      </a>
                    </div>
                    {res.depositAmount > 0 && (
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>დეპოზიტი: {res.depositAmount} ₾</span>
                      </div>
                    )}
                    {res.notes && (
                      <p className="text-[11px] text-slate-400 italic bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/50">
                        "{res.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                {isConfirmed && (
                  <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      onClick={() => handleConvertToSession(res)}
                      disabled={convertingId === res.id}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{convertingId === res.id ? 'იწყება...' : 'სესიის დაწყება'}</span>
                    </button>

                    <button
                      onClick={() => handleCancelReservation(res.id)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs transition cursor-pointer"
                      title="ჯავშნის გაუქმება"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
