import React, { useState, useEffect, useMemo } from 'react';
import { Device, DeviceCategory, DeviceStatus, Session } from '../../types';
import { DeviceCard } from '../DeviceCard';
import {
  Monitor,
  Gamepad2,
  Disc,
  Layers,
  Search,
  Filter,
  Sparkles,
  Plus
} from 'lucide-react';

interface PlayRoomViewProps {
  devices: Device[];
  sessions: Session[];
  onStartSession: (device: Device) => void;
  onFinishSession: (session: Session) => void;
  onExtendSession: (session: Session, minutes: number) => void;
  onUpdateExtras?: (session: Session) => void;
  onToggleStatus?: (device: Device, newStatus: DeviceStatus) => void;
  onCancelSession?: (session: Session) => void;
  onTerminateSession?: (session: Session) => void;
  onOpenNewSession: () => void;
  onBookDevice?: (device: Device) => void;
}

export const PlayRoomView: React.FC<PlayRoomViewProps> = ({
  devices,
  sessions,
  onStartSession,
  onFinishSession,
  onExtendSession,
  onUpdateExtras,
  onToggleStatus,
  onCancelSession,
  onTerminateSession,
  onOpenNewSession,
  onBookDevice
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Map active sessions by deviceId
  const activeSessionMap = new Map<string, Session>();
  sessions.forEach(s => {
    if (s.status === 'ACTIVE') {
      activeSessionMap.set(s.deviceId, s);
    }
  });

  // ცოცხალი წამზომი — გადაცილებული მოწყობილობების თავში ამოსატანად
  const [tick, setTick] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredDevices = devices.filter(d => {
    if (selectedCategory !== 'ALL' && d.category !== selectedCategory) return false;
    if (selectedStatus !== 'ALL' && d.status !== selectedStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const session = activeSessionMap.get(d.id);
      const matchesDevice = d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q);
      const matchesCustomer = session?.customerName?.toLowerCase().includes(q) || session?.customerPhone?.includes(q);
      if (!matchesDevice && !matchesCustomer) return false;
    }
    return true;
  });

  /**
   * დალაგება:
   * 1. მოწყობილობები, რომლებსაც დრო გაუვიდათ — ყოველთვის თავში,
   * 2. შემდეგ ის, ვისაც 5 წუთზე ნაკლები დარჩა,
   * 3. მიმდინარე (ღია) სესიები,
   * 4. დანარჩენი — ჩვეულებრივი თანმიმდევრობით.
   */
  const CATEGORY_ORDER: Record<string, number> = {
    [DeviceCategory.PC]: 0,
    [DeviceCategory.PLAYSTATION]: 1,
    [DeviceCategory.WHEEL]: 2
  };

  const sortedDevices = useMemo(() => {
    const priority = (d: Device): { rank: number; overdueMs: number } => {
      const session = activeSessionMap.get(d.id);
      if (!session) return { rank: 4, overdueMs: 0 };
      if (session.isOpen) return { rank: 3, overdueMs: 0 };

      const remainingMs = new Date(session.plannedEndTime).getTime() - tick;
      if (remainingMs <= 0) return { rank: 0, overdueMs: -remainingMs };
      if (remainingMs < 5 * 60 * 1000) return { rank: 1, overdueMs: 0 };
      return { rank: 2, overdueMs: 0 };
    };

    return [...filteredDevices].sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa.rank !== pb.rank) return pa.rank - pb.rank;
      if (pa.rank === 0) return pb.overdueMs - pa.overdueMs; // ყველაზე დიდი გადაცილება პირველი
      // დანარჩენები ჯგუფდება ზონების მიხედვით: PC → PlayStation → საჭე
      const catDiff = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
      if (catDiff !== 0) return catDiff;
      return (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name);
    });
  }, [filteredDevices, activeSessionMap, tick]);

  const overdueCount = devices.filter(d => {
    const s = activeSessionMap.get(d.id);
    return s && !s.isOpen && new Date(s.plannedEndTime).getTime() <= tick;
  }).length;

  // Count by category
  const pcCount = devices.filter(d => d.category === DeviceCategory.PC).length;
  const psCount = devices.filter(d => d.category === DeviceCategory.PLAYSTATION).length;
  const wheelCount = devices.filter(d => d.category === DeviceCategory.WHEEL).length;

  const availableCount = devices.filter(d => d.status === DeviceStatus.AVAILABLE).length;
  const occupiedCount = devices.filter(d => d.status === DeviceStatus.OCCUPIED).length;

  return (
    <div className="space-y-6">
      {/* Category Tabs & Quick Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ყველა ზონა ({devices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory(DeviceCategory.PC)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              selectedCategory === DeviceCategory.PC
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span>PC ზონა ({pcCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory(DeviceCategory.PLAYSTATION)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              selectedCategory === DeviceCategory.PLAYSTATION
                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Gamepad2 className="w-4 h-4 text-purple-400" />
            <span>PlayStation ({psCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory(DeviceCategory.WHEEL)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              selectedCategory === DeviceCategory.WHEEL
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Disc className="w-4 h-4 text-amber-400" />
            <span>Wheel / საჭე ({wheelCount})</span>
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedStatus === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              სულ ({devices.length})
            </button>
            <button
              onClick={() => setSelectedStatus(DeviceStatus.AVAILABLE)}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedStatus === DeviceStatus.AVAILABLE ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              თავისუფალი ({availableCount})
            </button>
            <button
              onClick={() => setSelectedStatus(DeviceStatus.OCCUPIED)}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                selectedStatus === DeviceStatus.OCCUPIED ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              დაკავებული ({occupiedCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="მოძებნე მოწყობილობა ან კლიენტი..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* გადაცილებული დროის შეტყობინება */}
      {overdueCount > 0 && (
        <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
          <span>{overdueCount} მოწყობილობას დრო ამოეწურა — ისინი სიის თავშია.</span>
        </div>
      )}

      {/* Device Cards Grid */}
      {sortedDevices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedDevices.map(device => {
            const activeSession = activeSessionMap.get(device.id);
            return (
              <DeviceCard
                key={device.id}
                device={device}
                session={activeSession}
                onStartSession={onStartSession}
                onFinishSession={onFinishSession}
                onExtendSession={onExtendSession}
                onUpdateExtras={onUpdateExtras}
                onToggleStatus={onToggleStatus}
                onCancelSession={onCancelSession}
                onTerminateSession={onTerminateSession}
                onBookDevice={onBookDevice}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">მოწყობილობები ვერ მოიძებნა</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            არჩეული ფილტრის ან ძებნის პარამეტრებით მოწყობილობები არ არსებობს.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setSelectedStatus('ALL');
              setSearch('');
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            ფილტრების გასუფთავება
          </button>
        </div>
      )}
    </div>
  );
};
