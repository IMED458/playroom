import React, { useState, useEffect } from 'react';
import { Device, DeviceCategory, DeviceStatus, Session } from '../types';
import {
  Monitor,
  Gamepad2,
  Disc,
  Play,
  CheckCircle2,
  Clock,
  Plus,
  AlertTriangle,
  User,
  Phone,
  Tag,
  Wrench,
  Sparkles,
  Ticket,
  CreditCard,
  Calendar,
  Infinity as InfinityIcon,
  Ban
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { sounds } from '../lib/audio';

interface DeviceCardProps {
  device: Device;
  session?: Session;
  onStartSession: (device: Device) => void;
  onFinishSession: (session: Session) => void;
  onExtendSession: (session: Session, minutes: number) => void;
  onUpdateExtras?: (session: Session) => void;
  onToggleStatus?: (device: Device, newStatus: DeviceStatus) => void;
  onCancelSession?: (session: Session) => void;
  onTerminateSession?: (session: Session) => void;
  onBookDevice?: (device: Device) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  session,
  onStartSession,
  onFinishSession,
  onExtendSession,
  onUpdateExtras,
  onToggleStatus,
  onCancelSession,
  onTerminateSession,
  onBookDevice
}) => {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('00:00:00');
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isOverdue, setIsOverdue] = useState<boolean>(false);
  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const isOpenSession = !!session?.isOpen;

  useEffect(() => {
    if (device.status !== DeviceStatus.OCCUPIED || !session) {
      setLivePrice(null);
      return;
    }

    const calculateTimer = () => {
      const now = new Date().getTime();
      const start = new Date(session.startTime).getTime();
      const plannedEnd = new Date(session.plannedEndTime).getTime();
      const totalPlannedMs = plannedEnd - start;

      const elapsedMs = Math.max(0, now - start);
      const elapsedMin = Math.floor(elapsedMs / 60000);
      setElapsedMinutes(elapsedMin);

      // „მიმდინარე" სესია — ტაიმერი ითვლის ზევით, გადაცილება არ არსებობს
      if (isOpenSession) {
        const sec = Math.floor(elapsedMs / 1000);
        const hrs = Math.floor(sec / 3600).toString().padStart(2, '0');
        const mins = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const secs = (sec % 60).toString().padStart(2, '0');
        setTimeLeftStr(`${hrs}:${mins}:${secs}`);
        setIsOverdue(false);
        setIsWarning(false);
        setProgressPercent(Math.min(100, (elapsedMin % 60) / 60 * 100));
        return;
      }

      const remainingMs = plannedEnd - now;

      if (remainingMs <= 0) {
        setIsOverdue(true);
        setIsWarning(false);
        const overdueSec = Math.floor(Math.abs(remainingMs) / 1000);
        const hrs = Math.floor(overdueSec / 3600).toString().padStart(2, '0');
        const mins = Math.floor((overdueSec % 3600) / 60).toString().padStart(2, '0');
        const secs = (overdueSec % 60).toString().padStart(2, '0');
        setTimeLeftStr(`+${hrs}:${mins}:${secs}`);
        setProgressPercent(100);
      } else {
        setIsOverdue(false);
        const remSec = Math.floor(remainingMs / 1000);
        const hrs = Math.floor(remSec / 3600).toString().padStart(2, '0');
        const mins = Math.floor((remSec % 3600) / 60).toString().padStart(2, '0');
        const secs = (remSec % 60).toString().padStart(2, '0');
        setTimeLeftStr(`${hrs}:${mins}:${secs}`);

        // If under 5 minutes left
        if (remainingMs < 5 * 60 * 1000) {
          setIsWarning(true);
        } else {
          setIsWarning(false);
        }

        const pct = totalPlannedMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalPlannedMs) * 100)) : 0;
        setProgressPercent(pct);
      }
    };

    calculateTimer();
    const interval = setInterval(calculateTimer, 1000);
    return () => clearInterval(interval);
  }, [device.status, session, isOpenSession]);

  // მიმდინარე სესიის ღირებულების ცოცხალი განახლება
  useEffect(() => {
    if (!session || device.status !== DeviceStatus.OCCUPIED) return;

    let cancelled = false;
    const fetchLivePrice = async () => {
      try {
        const data = await apiRequest<{ customerPaidAmount: number }>(`/sessions/${session.id}/live-price`);
        if (!cancelled) setLivePrice(data.customerPaidAmount);
      } catch {
        if (!cancelled) setLivePrice(null);
      }
    };

    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [session?.id, device.status]);

  const getCategoryIcon = () => {
    switch (device.category) {
      case DeviceCategory.PC:
        return <Monitor className="w-5 h-5 text-cyan-400" />;
      case DeviceCategory.PLAYSTATION:
        return <Gamepad2 className="w-5 h-5 text-purple-400" />;
      case DeviceCategory.WHEEL:
        return <Disc className="w-5 h-5 text-amber-400" />;
      default:
        return <Monitor className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (device.status) {
      case DeviceStatus.AVAILABLE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            თავისუფალი
          </span>
        );
      case DeviceStatus.OCCUPIED:
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isOpenSession
              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
              : isOverdue
              ? 'bg-red-500/25 border border-red-500/60 text-red-300 animate-pulse'
              : isWarning
              ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-red-400' : 'bg-rose-400'} animate-ping`}></span>
            {isOpenSession ? 'მიმდინარე' : isOverdue ? 'დრო ამოიწურა' : 'დაკავებული'}
          </span>
        );
      case DeviceStatus.MAINTENANCE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-300">
            <Wrench className="w-3 h-3" />
            სერვისი
          </span>
        );
      case DeviceStatus.RESERVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/40 text-blue-300">
            დაჯავშნილი
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            {device.status}
          </span>
        );
    }
  };

  const isOccupied = device.status === DeviceStatus.OCCUPIED && session;

  return (
    <div
      id={`device-card-${device.id}`}
      className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xl ${
        isOverdue
          ? 'bg-red-950/25 border-red-500/50 shadow-red-950/40'
          : isOccupied
          ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
          : 'bg-slate-900/50 border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-900/80'
      }`}
    >
      {/* Header Info */}
      <div className="p-4 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              {getCategoryIcon()}
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">{device.name}</h3>
              <p className="text-[11px] text-slate-400 capitalize">{device.category}</p>
            </div>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Hourly Rate preview if available */}
        {!isOccupied && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>სტანდარტული ტარიფი:</span>
            <span className="font-semibold text-slate-200 font-mono">
              {(device.hourlyPrice ?? 0).toFixed(2)} ₾ / სთ
            </span>
          </div>
        )}
      </div>

      {/* Middle Body */}
      <div className="p-4 flex-1 flex flex-col justify-center">
        {isOccupied ? (
          <div className="space-y-3">
            {/* Live Countdown Clock */}
            <div className="text-center py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mb-0.5 flex items-center justify-center gap-1">
                {isOpenSession && <InfinityIcon className="w-3 h-3 text-emerald-400" />}
                <span>{isOpenSession ? 'ნათამაშები დრო' : isOverdue ? 'გადაცილებული დრო' : 'დარჩენილი დრო'}</span>
              </div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  isOpenSession ? 'text-emerald-400' : isOverdue ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'
                }`}
              >
                {timeLeftStr}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOpenSession ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Session Details Pills */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <span className="text-slate-400 block text-[10px]">ხანგრძლივობა</span>
                <span className="font-semibold text-slate-200">
                  {isOpenSession ? `${elapsedMinutes} წთ (ღია)` : `${session.plannedDurationMinutes} წუთი`}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <span className="text-slate-400 block text-[10px]">
                  {isOpenSession || isOverdue ? 'მიმდინარე თანხა' : 'თანხა'}
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  {session.isFitPass
                    ? '0.00 ₾ (FitPass)'
                    : `${(livePrice ?? session.customerPaidAmount).toFixed(2)} ₾`}
                </span>
              </div>
            </div>

            {/* Badges: Extra controllers / Voucher / FitPass / Customer */}
            <div className="flex flex-wrap gap-1.5">
              {session.isFitPass && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Sparkles className="w-3 h-3" /> FitPass
                </span>
              )}
              {session.voucherCode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Ticket className="w-3 h-3" /> {session.voucherCode}
                </span>
              )}
              {session.extraControllersCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  +{session.extraControllersCount} კონტროლერი ({session.extraControllersPrice} ₾)
                </span>
              )}
              {session.discountAmount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  -{session.discountAmount} ₾ ფასდაკლება
                </span>
              )}
            </div>

            {/* Customer Info if present */}
            {session.customerName && (
              <div className="flex items-center gap-2 text-xs text-slate-300 pt-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium truncate">{session.customerName}</span>
                {session.customerPhone && <span className="text-slate-500 font-mono text-[11px]">({session.customerPhone})</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center">
            {device.status === DeviceStatus.AVAILABLE && (
              <div className="text-slate-400 text-xs">
                მოწყობილობა მზადაა ახალი მოთამაშისთვის
              </div>
            )}
            {device.status === DeviceStatus.MAINTENANCE && (
              <div className="text-amber-400/80 text-xs flex items-center justify-center gap-1.5">
                <Wrench className="w-4 h-4" />
                მოწყობილობა ტექნიკურ შემოწმებაზეა
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800/60">
        {isOccupied ? (
          <div className="space-y-2">
            {/* Quick Extension Buttons */}
            <div className={`grid grid-cols-2 gap-1.5 ${isOpenSession ? 'hidden' : ''}`}>
              <button
                type="button"
                onClick={() => onExtendSession(session, 30)}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3 text-cyan-400" />
                <span>+30 წთ</span>
              </button>
              <button
                type="button"
                onClick={() => onExtendSession(session, 60)}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3 text-cyan-400" />
                <span>+60 წთ</span>
              </button>
            </div>

            {/* PlayStation Extra Controllers button */}
            {device.category === DeviceCategory.PLAYSTATION && onUpdateExtras && (
              <button
                type="button"
                onClick={() => onUpdateExtras(session)}
                className="w-full py-1.5 px-2 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>კონტროლერების რედაქტირება ({session.extraControllersCount})</span>
              </button>
            )}

            {/* Finish & Settle / Cancel */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onFinishSession(session)}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>დასრულება & გადახდა</span>
              </button>

              {onTerminateSession && (
                <button
                  type="button"
                  onClick={() => onTerminateSession(session)}
                  title="თამაშის შეწყვეტა (გადახდის გარეშე)"
                  className="p-2 rounded-xl bg-orange-950/40 hover:bg-orange-900/50 border border-orange-500/40 text-orange-300 transition cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}

              {onCancelSession && (
                <button
                  type="button"
                  onClick={() => onCancelSession(session)}
                  title="სესიის გაუქმება (შეცდომით დაწყებული)"
                  className="p-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 transition cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {device.status === DeviceStatus.AVAILABLE ? (
              <>
                <button
                  type="button"
                  onClick={() => onStartSession(device)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>დაწყება</span>
                </button>

                {onBookDevice && (
                  <button
                    type="button"
                    onClick={() => onBookDevice(device)}
                    title="წინასწარი დაჯავშნა"
                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  >
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">დაჯავშნა</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => onToggleStatus && onToggleStatus(device, DeviceStatus.AVAILABLE)}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                გააქტიურება (Available)
              </button>
            )}

            {onToggleStatus && device.status === DeviceStatus.AVAILABLE && (
              <button
                type="button"
                onClick={() => onToggleStatus(device, DeviceStatus.MAINTENANCE)}
                title="სერვისზე გადაყვანა"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-amber-400 transition cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
