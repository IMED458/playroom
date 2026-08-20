import React, { useState, useEffect } from 'react';
import { PaymentMethod, Session } from '../types';
import { apiRequest } from '../lib/api';
import {
  X,
  CheckCircle2,
  CreditCard,
  Banknote,
  Send,
  Sparkles,
  AlertCircle,
  Infinity as InfinityIcon,
  Pencil
} from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface FinishSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onFinished: () => void;
  /** ადმინს/ოპერატორს შეუძლია საბოლოო თანხის ხელით კორექცია */
  canOverrideAmount?: boolean;
}

interface LivePrice {
  elapsedMinutes: number;
  billedMinutes: number;
  hourlyRate: number;
  basePrice: number;
  extraControllersPrice: number;
  discountAmount: number;
  voucherCoveredAmount: number;
  finalPrice: number;
  customerPaidAmount: number;
}

export const FinishSessionModal: React.FC<FinishSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  onFinished,
  canOverrideAmount = false
}) => {
  useBodyScrollLock(isOpen);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [customerName, setCustomerName] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LivePrice | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState<boolean>(false);
  const [overrideAmount, setOverrideAmount] = useState<string>('');

  // საბოლოო თანხა ყოველთვის სერვერზე ითვლება — მოდალი ცოცხლად აჩვენებს
  useEffect(() => {
    if (!isOpen || !session) return;

    setError(null);
    setPaymentMethod(session.isFitPass ? PaymentMethod.FITPASS : PaymentMethod.CASH);
    setCustomerName(session.customerName || '');
    setComment('');
    setOverrideEnabled(false);
    setOverrideAmount('');
    setLive(null);

    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiRequest<LivePrice>(`/sessions/${session.id}/live-price`);
        if (!cancelled) {
          setLive(data);
          setOverrideAmount(data.customerPaidAmount.toFixed(2));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'ღირებულების გამოთვლა ვერ მოხერხდა.');
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isOpen, session?.id]);

  if (!isOpen || !session) return null;

  const dueAmount = live ? live.customerPaidAmount : session.customerPaidAmount;

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest(`/sessions/${session.id}/finish`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: session.isFitPass ? PaymentMethod.FITPASS : paymentMethod,
          paidAmount: overrideEnabled ? Number(overrideAmount) : undefined,
          customerName: customerName.trim() || undefined,
          comment: comment.trim() || undefined
        })
      });

      sounds.playSessionFinishedAlert();
      onFinished();
      onClose();
    } catch (err: any) {
      setError(err.message || 'სესიის დასრულება ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">სესიის დასრულება & გადახდა</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                {session.isOpen && <InfinityIcon className="w-3 h-3 text-emerald-400" />}
                <span>{session.deviceName} ({session.deviceCategory})</span>
              </p>
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

        <form onSubmit={handleFinish} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-0.5">დაწყების დრო</span>
              <span className="font-semibold text-slate-200 font-mono">
                {new Date(session.startTime).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-0.5">ნათამაშები / ასაღები</span>
              <span className="font-bold text-cyan-400 font-mono">
                {live ? `${live.elapsedMinutes} წთ → ${live.billedMinutes} წთ` : '...'}
              </span>
            </div>
          </div>

          {/* გათვლის დეტალები */}
          {live && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>საბაზისო ({live.hourlyRate} ₾/სთ × {(live.billedMinutes / 60).toFixed(1)} სთ)</span>
                <span className="font-mono text-slate-200">{live.basePrice.toFixed(2)} ₾</span>
              </div>
              {live.extraControllersPrice > 0 && (
                <div className="flex items-center justify-between text-purple-300">
                  <span>დამატებითი კონტროლერები</span>
                  <span className="font-mono">+{live.extraControllersPrice.toFixed(2)} ₾</span>
                </div>
              )}
              {live.discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>ფასდაკლება</span>
                  <span className="font-mono">-{live.discountAmount.toFixed(2)} ₾</span>
                </div>
              )}
              {live.voucherCoveredAmount > 0 && (
                <div className="flex items-center justify-between text-purple-300">
                  <span>ვაუჩერით დაფარული</span>
                  <span className="font-mono">-{live.voucherCoveredAmount.toFixed(2)} ₾</span>
                </div>
              )}
            </div>
          )}

          {!session.isFitPass ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                გადახდის მეთოდი *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                    paymentMethod === PaymentMethod.CASH
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span>ნაღდი</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.CARD)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                    paymentMethod === PaymentMethod.CARD
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <span>ბარათი</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.TRANSFER)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                    paymentMethod === PaymentMethod.TRANSFER
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm shadow-purple-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Send className="w-4 h-4 text-purple-400" />
                  <span>გადმორიცხვა</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-cyan-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-cyan-300">FitPass პარტნიორული სესია</div>
                <div className="text-[11px] text-slate-400">
                  კლიენტისთვის უფასოა (0.00 ₾), ნომინალი აისახება ანგარიშგებაში.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              placeholder="კლიენტის სახელი (არასავალდებულო)"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
            />
            <input
              type="text"
              placeholder="კომენტარი / შენიშვნა"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
            />
          </div>

          {/* საბოლოო თანხა + ხელით კორექცია */}
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">გადასახდელი თანხა</span>
                <span className="text-[11px] text-slate-500">
                  {session.isFitPass ? 'FitPass დაფარვა' : `ტარიფი: ${live?.hourlyRate ?? session.hourlyRate} ₾/სთ`}
                </span>
              </div>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {session.isFitPass ? '0.00 ₾' : `${dueAmount.toFixed(2)} ₾`}
              </span>
            </div>

            {canOverrideAmount && !session.isFitPass && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideEnabled}
                    onChange={e => setOverrideEnabled(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900"
                  />
                  <Pencil className="w-3 h-3 text-amber-400" />
                  <span>თანხის ხელით კორექცია</span>
                </label>

                {overrideEnabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={overrideAmount}
                      onChange={e => setOverrideAmount(e.target.value)}
                      className="w-32 bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-400">
                      ₾ — სხვაობა აღირიცხება როგორც გადაუხდელი ნაშთი
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              გაუქმება
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'მუშავდება...' : 'გადახდა & დასრულება'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
