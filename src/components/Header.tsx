import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleName } from '../types';
import {
  Gamepad2,
  Clock,
  DollarSign,
  UserCheck,
  LogOut,
  Sparkles,
  Wand2,
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { sounds } from '../lib/audio';

interface HeaderProps {
  onOpenNewSession: () => void;
  onOpenTodaySales: () => void;
  onOpenClockModal: () => void;
  onOpenWizardModal: () => void;
  activeSessionsCount: number;
  totalDevicesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewSession,
  onOpenTodaySales,
  onOpenClockModal,
  onOpenWizardModal,
  activeSessionsCount,
  totalDevicesCount
}) => {
  const { user, logout, activeShift, quickLogin } = useAuth();
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [shiftElapsed, setShiftElapsed] = useState<string>('00:00:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('ka-GE', { day: '2-digit', month: '2-digit', year: 'numeric' }));

      if (activeShift && activeShift.startTime) {
        const start = new Date(activeShift.startTime).getTime();
        const diffSec = Math.max(0, Math.floor((now.getTime() - start) / 1000));
        const hrs = Math.floor(diffSec / 3600).toString().padStart(2, '0');
        const mins = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
        const secs = (diffSec % 60).toString().padStart(2, '0');
        setShiftElapsed(`${hrs}:${mins}:${secs}`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    sounds.setEnabled(next);
    if (next) sounds.playBeep(880, 0.1);
  };

  const getRoleBadge = (role?: RoleName) => {
    switch (role) {
      case RoleName.SUPER_ADMIN:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300">Super Admin</span>;
      case RoleName.ADMIN:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 border border-blue-500/40 text-blue-300">Admin</span>;
      case RoleName.OPERATOR:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">Operator</span>;
      default:
        return null;
    }
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Live Clock */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wide">Play Room Arena</h1>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Tbilisi ₾
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span className="text-slate-200 font-semibold">{time}</span>
                <span>•</span>
                <span>{date}</span>
              </p>
            </div>
          </div>

          {/* Occupancy Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400">დატვირთვა:</span>
            <span className="font-bold text-cyan-400 font-mono">
              {activeSessionsCount} / {totalDevicesCount}
            </span>
            <span className={`w-2 h-2 rounded-full ${activeSessionsCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          </div>
        </div>

        {/* Action Controls & Fast Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Start Session Button */}
          <button
            onClick={onOpenNewSession}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition active:scale-[0.97] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>ახალი სესია</span>
          </button>

          {/* Today's Sales ("დღის ნავაჭრი") */}
          <button
            onClick={onOpenTodaySales}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span>დღის ნავაჭრი</span>
          </button>

          {/* Staff Shift Clock Button */}
          <button
            onClick={onOpenClockModal}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
              activeShift
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>{activeShift ? `ცვლა: ${shiftElapsed}` : 'სამუშაოს დაწყება'}</span>
          </button>

          {/* Setup Wizard (Super Admin Only) */}
          {user?.role === RoleName.SUPER_ADMIN && (
            <button
              onClick={onOpenWizardModal}
              title="Setup Wizard — პირველადი კონფიგურაცია"
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Wizard</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={soundOn ? 'ხმა ჩართულია' : 'ხმა გამორთულია'}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* User Profile & Role Switcher */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{user?.fullName}</div>
              <div className="flex items-center justify-end gap-1">
                {getRoleBadge(user?.role)}
              </div>
            </div>

            <button
              onClick={logout}
              title="გამოსვლა"
              className="p-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-400 hover:text-red-300 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
