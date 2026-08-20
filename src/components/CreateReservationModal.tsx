import React, { useState, useEffect } from 'react';
import { Device, DeviceCategory, Reservation, ReservationStatus } from '../types';
import { apiRequest } from '../lib/api';
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  Gamepad2,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface CreateReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  initialDevice?: Device | null;
  initialDate?: string;
  onReservationCreated: () => void;
}

export const CreateReservationModal: React.FC<CreateReservationModalProps> = ({
  isOpen,
  onClose,
  devices,
  initialDevice,
  initialDate,
  onReservationCreated
}) => {
  useBodyScrollLock(isOpen);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  
  // Format current or initial date for datetime-local (YYYY-MM-DDTHH:mm)
  const getNowFormatted = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15); // Default to 15 mins from now
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [startTime, setStartTime] = useState<string>(getNowFormatted());
  const [hasEndTime, setHasEndTime] = useState<boolean>(false);
  const [endTime, setEndTime] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialDevice) {
        setSelectedDeviceId(initialDevice.id);
      } else if (devices.length > 0) {
        setSelectedDeviceId(devices[0].id);
      }
      setStartTime(getNowFormatted());
      setHasEndTime(false);
      setEndTime('');
      setDepositAmount(0);
      setNotes('');
      setError(null);
    }
  }, [isOpen, initialDevice, devices]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      setError('გთხოვთ აირჩიოთ მოწყობილობა.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('გთხოვთ მიუთითოთ კლიენტის სახელი და ტელეფონი.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          startTime: new Date(startTime).toISOString(),
          endTime: hasEndTime && endTime ? new Date(endTime).toISOString() : null,
          depositAmount: Number(depositAmount) || 0,
          notes: notes.trim() || undefined,
          status: ReservationStatus.CONFIRMED
        })
      });

      sounds.playSuccessTone();
      onReservationCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'ჯავშნის შექმნა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">წინასწარი ჯავშნის რეგისტრაცია</h3>
              <p className="text-xs text-slate-400">კომპიუტერის ან კონსოლის დაჯავშნა მომხმარებლისთვის</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Device Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>მოწყობილობის არჩევა *</span>
            </label>
            <select
              value={selectedDeviceId}
              onChange={e => setSelectedDeviceId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500 cursor-pointer"
              required
            >
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.category}) — {d.status === 'AVAILABLE' ? 'თავისუფალი' : 'დაკავებული'}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>კლიენტის სახელი *</span>
              </label>
              <input
                type="text"
                required
                placeholder="მაგ: გიორგი"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>ტელეფონის ნომერი *</span>
              </label>
              <input
                type="tel"
                required
                placeholder="5XX XX XX XX"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Time Fields */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>ჯავშნის დაწყების დრო (რომელი საათიდან) *</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-amber-500 cursor-pointer"
              />
            </div>

            {/* Optional End Time Checkbox & Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasEndTime}
                    onChange={e => {
                      setHasEndTime(e.target.checked);
                      if (e.target.checked && !endTime) {
                        const s = new Date(startTime);
                        s.setHours(s.getHours() + 2);
                        const tzOffset = s.getTimezoneOffset() * 60000;
                        setEndTime(new Date(s.getTime() - tzOffset).toISOString().slice(0, 16));
                      }
                    }}
                    className="w-4 h-4 rounded text-amber-500 cursor-pointer"
                  />
                  <span>დასრულების დროის მითითება (არასავალდებულო)</span>
                </label>
                <span className="text-[10px] text-slate-500">თუ კლიენტმა იცის ზუსტი დრო</span>
              </div>

              {hasEndTime && (
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-amber-500 cursor-pointer mt-1"
                />
              )}
            </div>
          </div>

          {/* Deposit & Prepayment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>წინასწარი დეპოზიტი / ბე (₾)</span>
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={depositAmount}
                onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">ჩამოიჭრება სესიის დასრულებისას</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                <span>კომენტარი / შენიშვნა</span>
              </label>
              <input
                type="text"
                placeholder="მაგ: 2 დამატებითი ჯოისტიკით"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-bold shadow-lg shadow-amber-600/25 transition cursor-pointer"
            >
              {loading ? 'იჯავშნება...' : 'ჯავშნის დადასტურება'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
