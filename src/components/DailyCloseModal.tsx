import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import {
  X,
  Lock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  CreditCard,
  Send,
  Calendar
} from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface DailyCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClosed: () => void;
}

export const DailyCloseModal: React.FC<DailyCloseModalProps> = ({ isOpen, onClose, onClosed }) => {
  useBodyScrollLock(isOpen);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualCash, setActualCash] = useState<string>('');
  const [comment, setComment] = useState('');
  const [summaryData, setSummaryData] = useState<any>(null);
  const [payoutInfo, setPayoutInfo] = useState<{ paidCash: number; pending: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSummary = async () => {
      try {
        const data = await apiRequest<any>('/finance/today-summary');
        setSummaryData(data.summary);

        // პერსონალის ანაზღაურება, რომელიც სალაროდან გაიცა
        const payouts = await apiRequest<any>(`/employees/payouts?date=${date}`).catch(() => null);
        let paidCash = 0;
        let pending = 0;
        (payouts?.payouts || []).forEach((p: any) => {
          if (p.status === 'PAID' && (!p.paymentMethod || p.paymentMethod === 'CASH')) paidCash += p.amount;
          else if (p.status !== 'PAID') pending += p.amount;
        });
        setPayoutInfo({ paidCash: Math.round(paidCash * 100) / 100, pending: Math.round(pending * 100) / 100 });

        const expected = Math.round(((data.summary?.cash || 0) - paidCash) * 100) / 100;
        setActualCash(String(expected));
      } catch {}
    };

    fetchSummary();
  }, [isOpen]);

  if (!isOpen) return null;

  const expectedCash = Math.round(((summaryData?.cash || 0) - (payoutInfo?.paidCash || 0)) * 100) / 100;
  const actualNum = parseFloat(actualCash) || 0;
  const diff = Math.round((actualNum - expectedCash) * 100) / 100;

  const handleCloseDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/finance/close-day', {
        method: 'POST',
        body: JSON.stringify({
          date,
          actualCash: actualNum,
          comment: comment.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      onClosed();
      onClose();
    } catch (err: any) {
      setError(err.message || 'დღის დახურვა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">დღის დახურვა (Daily Close)</h2>
              <p className="text-xs text-slate-400">სალაროს შემოწმება და ფინანსური snapshot-ის დაფიქსირება</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCloseDay} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              დახურვის თარიღი
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-red-500"
              required
            />
          </div>

          {/* Expected vs Actual Cash */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>ნაღდი შემოსავალი:</span>
              <span className="font-mono text-slate-200">{(summaryData?.cash || 0).toFixed(2)} ₾</span>
            </div>

            {payoutInfo && payoutInfo.paidCash > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-300">
                <span>ნაღდით გაცემული ანაზღაურება:</span>
                <span className="font-mono">-{payoutInfo.paidCash.toFixed(2)} ₾</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-800">
              <span className="font-semibold">მოსალოდნელი ნაღდი სალაროში:</span>
              <span className="font-mono font-bold text-emerald-400">{expectedCash.toFixed(2)} ₾</span>
            </div>

            {payoutInfo && payoutInfo.pending > 0 && (
              <div className="text-[11px] text-amber-400/80">
                ყურადღება: {payoutInfo.pending.toFixed(2)} ₾ პერსონალის ანაზღაურება ჯერ არ არის გაცემული.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                ფაქტობრივი თანხა სალაროში (Actual Cash) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-red-500"
                required
              />
            </div>

            <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between font-mono font-semibold ${
              diff === 0
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : diff > 0
                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                : 'bg-red-500/10 text-red-300 border border-red-500/30'
            }`}>
              <span>სხვაობა (Difference):</span>
              <span>{diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} ₾</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              დახურვის კომენტარი / შენიშვნა
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="მაგ: სალარო დაემთხვა, ცვლა გადაებარა..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? 'იხურება...' : 'დღის დახურვა & ჩაკეტვა'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
