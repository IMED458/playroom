import React from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleName } from '../types';
import {
  Gamepad2,
  Clock,
  DollarSign,
  TrendingUp,
  Tag,
  Trophy,
  Users,
  Settings,
  ShieldCheck,
  Flame,
  Calendar
} from 'lucide-react';

export type NavTab = 'PLAY_ROOM' | 'BOOKINGS' | 'SESSIONS' | 'FINANCE' | 'REPORTS' | 'DISCOUNTS' | 'TOURNAMENTS' | 'STAFF' | 'SETTINGS';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeSessionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, activeSessionsCount }) => {
  const { user } = useAuth();

  const isAdmin = user?.role === RoleName.ADMIN || user?.role === RoleName.SUPER_ADMIN;

  const navItems = [
    {
      id: 'PLAY_ROOM' as NavTab,
      label: 'Play Room არენა',
      icon: Gamepad2,
      badge: activeSessionsCount > 0 ? `${activeSessionsCount} აქტიური` : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      allowed: true
    },
    {
      id: 'BOOKINGS' as NavTab,
      label: 'წინასწარი ჯავშნები',
      icon: Calendar,
      allowed: true
    },
    {
      id: 'SESSIONS' as NavTab,
      label: 'სესიების ჟურნალი',
      icon: Clock,
      allowed: true
    },
    {
      id: 'FINANCE' as NavTab,
      label: 'ფინანსები & სალარო',
      icon: DollarSign,
      allowed: true
    },
    {
      id: 'REPORTS' as NavTab,
      label: 'ანალიტიკა & BI',
      icon: TrendingUp,
      allowed: isAdmin
    },
    {
      id: 'DISCOUNTS' as NavTab,
      label: 'ფასდაკლება & ვაუჩერი',
      icon: Tag,
      allowed: isAdmin
    },
    {
      id: 'TOURNAMENTS' as NavTab,
      label: 'ტურნირები',
      icon: Trophy,
      allowed: true
    },
    {
      id: 'STAFF' as NavTab,
      label: 'პერსონალი & ხელფასები',
      icon: Users,
      allowed: isAdmin
    },
    {
      id: 'SETTINGS' as NavTab,
      label: 'პარამეტრები & RBAC',
      icon: Settings,
      // ადმინს აქვს სრული წვდომა პარამეტრებზეც
      allowed: isAdmin
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 hidden md:flex">
      <div className="p-4 space-y-6">
        {/* Navigation List */}
        <div className="space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            მთავარი მენიუ
          </div>

          {navItems.filter(item => item.allowed).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border border-cyan-500/40 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer System Status Badge */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>სისტემა მზადაა</span>
          </span>
          <span className="font-mono text-[10px] text-slate-500">v2.0</span>
        </div>
        <p className="text-[10px] text-slate-500">
          ლოკალური SQLite ბაზა • Asia/Tbilisi • ₾ GEL
        </p>
      </div>
    </aside>
  );
};
