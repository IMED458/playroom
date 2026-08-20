import React, { useState } from 'react';
import { Session } from '../types';
import { apiRequest } from '../lib/api';
import { X, Clock, Plus, AlertCircle } from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface ExtendSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  initialMinutes?: number;
  onExtended: () => void;
}

export const ExtendSessionModal: React.FC<ExtendSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  initialMinutes = 30,
  onExtended
}) => {
  useBodyScrollLock(isOpen);
  const [minutes, setMinutes] = useState<number>(initialMinutes);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest(`/sessions/${session.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ addMinutes: minutes })
      });

      sounds.playSuccessTone();
      onExtended();
      onClose();
    } catch (err: any) {
      setError(err.message || 'დროის დამატება ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">დროის დამატება</h2>
              <p className="text-xs text-slate-400">{session.deviceName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleExtend} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[30, 60, 90, 120, 180, 240].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  minutes === m
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                +{m} წუთი
              </button>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span>მიმდინარე ხანგრძლივობა:</span>
              <span className="font-semibold">{session.plannedDurationMinutes} წთ</span>
            </div>
            <div className="flex justify-between text-cyan-400 font-bold">
              <span>ახალი სრული დრო:</span>
              <span>{session.plannedDurationMinutes + minutes} წთ</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/25 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'ემატება...' : `+${minutes} წთ დამატება`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
