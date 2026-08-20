import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import {
  X,
  DollarSign,
  Banknote,
  CreditCard,
  Send,
  Sparkles,
  Ticket,
  Percent,
  Trophy,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface TodaySalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TodaySalesModal: React.FC<TodaySalesModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(isOpen);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchToday = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/finance/today-summary');
      setData(res);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchToday();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const s = data?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">დღის ნავაჭრი (Live Summary)</h2>
              <p className="text-xs text-slate-400">თარიღი: {s?.date || new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchToday}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="განახლება"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Main Total Callout */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">დღის სრული შემოსავალი</span>
              <div className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
                {s?.totalRevenue?.toFixed(2) || '0.00'} ₾
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{s?.totalSessionsCount || 0}</span> სესია დღეს
            </div>
          </div>

          {/* Payment Methods 3-Pillars */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                <span>ნაღდი (Cash)</span>
              </div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {s?.cash?.toFixed(2) || '0.00'} ₾
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                <span>ბარათი (Card)</span>
              </div>
              <div className="text-lg font-bold text-blue-400 font-mono">
                {s?.card?.toFixed(2) || '0.00'} ₾
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Send className="w-3.5 h-3.5 text-purple-400" />
                <span>გადმორიცხვა</span>
              </div>
              <div className="text-lg font-bold text-purple-400 font-mono">
                {s?.transfer?.toFixed(2) || '0.00'} ₾
              </div>
            </div>
          </div>

          {/* Special KPIs (FitPass / Vouchers / Tournaments / Discounts) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
              <div className="text-[10px] text-cyan-300 uppercase font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> FitPass
              </div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">
                {s?.fitpassCount || 0} სესია
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                ნომ: {s?.fitpassNominal?.toFixed(2) || '0.00'} ₾
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
              <div className="text-[10px] text-purple-300 uppercase font-semibold flex items-center gap-1">
                <Ticket className="w-3 h-3" /> ვაუჩერები
              </div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">
                {s?.voucherCount || 0} გამოყენებული
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20">
              <div className="text-[10px] text-amber-300 uppercase font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> ტურნირები
              </div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">
                {s?.tournamentRevenue?.toFixed(2) || '0.00'} ₾
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
              <div className="text-[10px] text-emerald-300 uppercase font-semibold flex items-center gap-1">
                <Percent className="w-3 h-3" /> ფასდაკლება
              </div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">
                {s?.totalDiscounts?.toFixed(2) || '0.00'} ₾
              </div>
            </div>
          </div>

          {/* Today's Transactions Log */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              დღევანდელი ტრანზაქციების ჟურნალი ({data?.transactions?.length || 0})
            </h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2">დრო</th>
                    <th className="p-2">წყარო / აღწერა</th>
                    <th className="p-2">მეთოდი</th>
                    <th className="p-2 text-right">თანხა</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data?.transactions && data.transactions.length > 0 ? (
                    data.transactions.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono text-slate-400">{t.time}</td>
                        <td className="p-2 truncate max-w-xs">{t.notes || t.source}</td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {t.payment_method}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-400">
                          {t.amount.toFixed(2)} ₾
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        დღეს ტრანზაქციები ჯერ არ დაფიქსირებულა
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
