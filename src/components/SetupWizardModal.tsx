import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import {
  X,
  Wand2,
  Monitor,
  Gamepad2,
  Disc,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onClose,
  onConfigured
}) => {
  useBodyScrollLock(isOpen);
  const [businessName, setBusinessName] = useState('Play Room Arena Tbilisi');
  const [pcCount, setPcCount] = useState(10);
  const [pcPrice, setPcPrice] = useState(10);
  const [psCount, setPsCount] = useState(4);
  const [psPrice, setPsPrice] = useState(15);
  const [wheelCount, setWheelCount] = useState(2);
  const [wheelPrice, setWheelPrice] = useState(20);
  const [extraControllerPrice, setExtraControllerPrice] = useState(3);
  const [morningStart, setMorningStart] = useState('10:00');
  const [morningEnd, setMorningEnd] = useState('18:00');
  const [eveningStart, setEveningStart] = useState('18:00');
  const [eveningEnd, setEveningEnd] = useState('02:00');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/settings/wizard', {
        method: 'POST',
        body: JSON.stringify({
          businessName,
          pcCount,
          pcPrice,
          psCount,
          psPrice,
          wheelCount,
          wheelPrice,
          extraControllerPrice,
          morningShiftStart: morningStart,
          morningShiftEnd: morningEnd,
          eveningShiftStart: eveningStart,
          eveningShiftEnd: eveningEnd
        })
      });

      sounds.playSuccessTone();
      onConfigured();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Setup Wizard ვერ შესრულდა.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">სისტემის Setup Wizard</h2>
              <p className="text-xs text-slate-400">მოწყობილობების რაოდენობის, ტარიფების და ცვლების სწრაფი კონფიგურაცია</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRunWizard} className="p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              ობიექტის დასახელება
            </label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-cyan-500"
              required
            >
            </input>
          </div>

          {/* Device Counts & Hourly Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* PC */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <Monitor className="w-4 h-4" />
                <span>Gaming PC</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">რაოდენობა (ცალი)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={pcCount}
                  onChange={e => setPcCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">ტარიფი (₾ / სთ)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={pcPrice}
                  onChange={e => setPcPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                />
              </div>
            </div>

            {/* PlayStation */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                <Gamepad2 className="w-4 h-4" />
                <span>PlayStation</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">რაოდენობა (ცალი)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={psCount}
                  onChange={e => setPsCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">ტარიფი (₾ / სთ)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={psPrice}
                  onChange={e => setPsPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                />
              </div>
            </div>

            {/* Wheel */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Disc className="w-4 h-4" />
                <span>Wheel / საჭე</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">რაოდენობა (ცალი)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={wheelCount}
                  onChange={e => setWheelCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">ტარიფი (₾ / სთ)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={wheelPrice}
                  onChange={e => setWheelPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* DualSense Controller & Shifts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <label className="block text-xs font-semibold text-purple-300 mb-1">
                დამატებითი კონტროლერის ტარიფი (₾ / სთ)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={extraControllerPrice}
                onChange={e => setExtraControllerPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <label className="block text-xs font-semibold text-cyan-300 mb-1">
                ცვლების განრიგი (დილა & საღამო/ღამე)
              </label>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div>დილა: {morningStart} – {morningEnd}</div>
                <div>ღამე: {eveningStart} – {eveningEnd} (+1 დღე)</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/25 flex items-center gap-2 cursor-pointer"
            >
              <Wand2 className="w-4 h-4" />
              <span>{submitting ? 'ინახება...' : 'კონფიგურაციის შენახვა'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
