import React, { useState } from 'react';
import { Session } from '../types';
import { apiRequest } from '../lib/api';
import { X, Gamepad2, AlertCircle } from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface UpdateExtrasModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onUpdated: () => void;
}

export const UpdateExtrasModal: React.FC<UpdateExtrasModalProps> = ({
  isOpen,
  onClose,
  session,
  onUpdated
}) => {
  useBodyScrollLock(isOpen);
  const [count, setCount] = useState<number>(session?.extraControllersCount || 0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest(`/sessions/${session.id}/update-extras`, {
        method: 'POST',
        body: JSON.stringify({ extraControllersCount: count })
      });

      sounds.playSuccessTone();
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'კონტროლერების განახლება ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">დამატებითი კონტროლერები</h2>
              <p className="text-xs text-slate-400">{session.deviceName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCount(c)}
                className={`py-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  count === c
                    ? 'bg-purple-500/30 border-purple-500 text-white shadow-sm shadow-purple-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {c === 0 ? 'არცერთი (0)' : `+${c} კონტროლერი`}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
            <p className="text-slate-400">
              * თითო დამატებითი კონტროლერის ტარიფი ავტომატურად გადაითვლება დარჩენილ/სრულ დროზე.
            </p>
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
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 cursor-pointer"
            >
              {submitting ? 'ინახება...' : 'შენახვა'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
