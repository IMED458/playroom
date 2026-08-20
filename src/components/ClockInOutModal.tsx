import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { Employee, ShiftDefinition } from '../types';
import {
  X,
  UserCheck,
  Clock,
  Play,
  Square,
  DollarSign,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface ClockInOutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClockInOutModal: React.FC<ClockInOutModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(isOpen);
  const { user, activeShift, refreshShift } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('სტანდარტული ცვლა');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        const empRes = await apiRequest<{ employees: Employee[] }>('/employees');
        setEmployees(empRes.employees);

        if (user?.employeeId) {
          setSelectedEmpId(user.employeeId);
        } else if (empRes.employees.length > 0) {
          setSelectedEmpId(empRes.employees[0].id);
        }

        const shiftRes = await apiRequest<{ shifts: ShiftDefinition[] }>('/employees/shifts');
        setShifts(shiftRes.shifts);
        if (shiftRes.shifts.length > 0) {
          setSelectedShift(shiftRes.shifts[0].name);
        }
      } catch {}
    };

    fetchData();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleClockIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/employees/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedEmpId,
          shiftName: selectedShift,
          notes: notes.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      await refreshShift();
      onClose();
    } catch (err: any) {
      setError(err.message || 'ცვლის დაწყება ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/employees/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: activeShift?.employeeId,
          attendanceId: activeShift?.id,
          notes: notes.trim() || undefined
        })
      });

      sounds.playSessionFinishedAlert();
      await refreshShift();
      onClose();
    } catch (err: any) {
      setError(err.message || 'ცვლის დასრულება ვერ მოხერხდა.');
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
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">სამუშაო ცვლის მართვა</h2>
              <p className="text-xs text-slate-400">თანამშრომლის აღრიცხვა & საათობრივი ტარიფი</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeShift ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/40 text-center">
                <span className="text-xs font-semibold text-emerald-400 block mb-1">
                  მიმდინარე აქტიური ცვლა
                </span>
                <div className="text-xl font-bold text-white mb-0.5">
                  {activeShift.employeeName}
                </div>
                <div className="text-xs text-slate-400">
                  დაწყება: {new Date(activeShift.startTime).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })} • ტარიფი: {activeShift.hourlyRate} ₾ / სთ
                </div>
              </div>

              <input
                type="text"
                placeholder="ცვლის დასრულების შენიშვნა..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
              />

              <button
                type="button"
                onClick={handleClockOut}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>{submitting ? 'სრულდება...' : 'ცვლის დასრულება (Clock Out)'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">თანამშრომელი</label>
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} ({e.role}) — {e.hourlySalary} ₾/სთ
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ცვლა</label>
                <select
                  value={selectedShift}
                  onChange={e => setSelectedShift(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {shifts.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                placeholder="შენიშვნა (არასავალდებულო)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
              />

              <button
                type="button"
                onClick={handleClockIn}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{submitting ? 'იწყება...' : 'სამუშაოს დაწყება (Clock In)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
