import React, { useState, useEffect } from 'react';
import { PaymentMethod, Session } from '../types';
import { apiRequest } from '../lib/api';
import { X, Ban, AlertCircle, Banknote, CreditCard, Send } from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface TerminateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onTerminated: () => void;
}

const REASONS = [
  'მოთამაშემ არ გადაიხადა',
  'თანხა არ ავიღეთ (ხელმძღვანელობის გადაწყვეტილება)',
  'ტექნიკური ხარვეზი მოწყობილობაზე',
  'მოთამაშემ დატოვა კლუბი',
  'კონფლიქტური სიტუაცია'
];

/**
 * თამაშის შეწყვეტა — სესია სრულდება, მოწყობილობა თავისუფლდება,
 * თანხა შეიძლება საერთოდ არ იყოს ამოღებული (ჩამოწერა) ან ნაწილობრივ.
 */
export const TerminateSessionModal: React.FC<TerminateSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  onTerminated
}) => {
  useBodyScrollLock(isOpen);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [collectedAmount, setCollectedAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [writeOff, setWriteOff] = useState<boolean>(true);
  const [dueAmount, setDueAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !session) return;
    setReason(REASONS[0]);
    setCustomReason('');
    setCollectedAmount('0');
    setPaymentMethod(PaymentMethod.CASH);
    setWriteOff(true);
    setError(null);
    setDueAmount(null);

    apiRequest<{ customerPaidAmount: number }>(`/sessions/${session.id}/live-price`)
      .then(d => setDueAmount(d.customerPaidAmount))
      .catch(() => setDueAmount(null));
  }, [isOpen, session?.id]);

  if (!isOpen || !session) return null;

  const collected = Math.max(0, parseFloat(collectedAmount) || 0);
  const unpaid = Math.max(0, (dueAmount ?? 0) - collected);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiRequest(`/sessions/${session.id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({
          reason: (customReason.trim() || reason),
          collectedAmount: collected,
          paymentMethod,
          writeOff
        })
      });

      sounds.playSessionFinishedAlert();
      onTerminated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'სესიის შეწყვეტა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-orange-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-orange-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">თამაშის შეწყვეტა</h2>
              <p className="text-xs text-slate-400">{session.deviceName} — {session.customerName || 'უცნობი მოთამაშე'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">დარიცხული თანხა შეწყვეტის მომენტისთვის</span>
            <span className="text-lg font-black text-amber-400 font-mono">
              {dueAmount !== null ? `${dueAmount.toFixed(2)} ₾` : '...'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              შეწყვეტის მიზეზი *
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-orange-500 cursor-pointer mb-2"
            >
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              type="text"
              placeholder="ან ჩაწერეთ სხვა მიზეზი (აუდიტისთვის)"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              რეალურად ამოღებული თანხა
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min="0"
                step="0.5"
                value={collectedAmount}
                onChange={e => setCollectedAmount(e.target.value)}
                className="w-32 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setCollectedAmount('0')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
              >
                0 ₾ (არ გადაიხადა)
              </button>
              {dueAmount !== null && (
                <button
                  type="button"
                  onClick={() => setCollectedAmount(dueAmount.toFixed(2))}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                >
                  სრული ({dueAmount.toFixed(2)} ₾)
                </button>
              )}
            </div>

            {collected > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { m: PaymentMethod.CASH, label: 'ნაღდი', Icon: Banknote },
                  { m: PaymentMethod.CARD, label: 'ბარათი', Icon: CreditCard },
                  { m: PaymentMethod.TRANSFER, label: 'გადმორიცხვა', Icon: Send }
                ].map(({ m, label, Icon }) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === m
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {unpaid > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">გადაუხდელი ნაშთი</span>
                <span className="font-mono font-bold text-red-400">{unpaid.toFixed(2)} ₾</span>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={writeOff}
                  onChange={e => setWriteOff(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900"
                />
                <span>
                  {writeOff
                    ? 'თანხა ჩამოიწერება — დავალიანება არ დარჩება'
                    : 'თანხა დარჩება როგორც დავალიანება (აღირიცხება ანგარიშგებაში)'}
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              დახურვა
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-orange-600/25 flex items-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              <span>{submitting ? 'მუშავდება...' : 'თამაშის შეწყვეტა'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
