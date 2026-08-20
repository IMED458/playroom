import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';

// Views
import { PlayRoomView } from './components/modules/PlayRoomView';
import { BookingsView } from './components/modules/BookingsView';
import { SessionsView } from './components/modules/SessionsView';
import { FinanceView } from './components/modules/FinanceView';
import { ReportsView } from './components/modules/ReportsView';
import { DiscountsVouchersView } from './components/modules/DiscountsVouchersView';
import { TournamentsView } from './components/modules/TournamentsView';
import { StaffPayrollView } from './components/modules/StaffPayrollView';
import { SettingsView } from './components/modules/SettingsView';

// Modals
import { StartSessionModal } from './components/StartSessionModal';
import { CreateReservationModal } from './components/CreateReservationModal';
import { FinishSessionModal } from './components/FinishSessionModal';
import { TerminateSessionModal } from './components/TerminateSessionModal';
import { ExtendSessionModal } from './components/ExtendSessionModal';
import { UpdateExtrasModal } from './components/UpdateExtrasModal';
import { TodaySalesModal } from './components/TodaySalesModal';
import { ClockInOutModal } from './components/ClockInOutModal';
import { SetupWizardModal } from './components/SetupWizardModal';
import { DailyCloseModal } from './components/DailyCloseModal';
import { PublicTournamentRegistrationView } from './components/public/PublicTournamentRegistrationView';

import { Device, DeviceStatus, Session } from './types';
import { apiRequest } from './lib/api';
import { sounds } from './lib/audio';
import {
  Gamepad2,
  Clock,
  DollarSign,
  TrendingUp,
  Tag,
  Trophy,
  Users,
  Settings,
  Calendar
} from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('PLAY_ROOM');

  // Core Data
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState<boolean>(false);
  const [targetDevice, setTargetDevice] = useState<Device | null>(null);

  const [isFinishModalOpen, setIsFinishModalOpen] = useState<boolean>(false);
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState<boolean>(false);
  const [targetSession, setTargetSession] = useState<Session | null>(null);

  const [isExtendModalOpen, setIsExtendModalOpen] = useState<boolean>(false);
  const [extendMinutes, setExtendMinutes] = useState<number>(30);

  const [isExtrasModalOpen, setIsExtrasModalOpen] = useState<boolean>(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState<boolean>(false);
  const [isClockModalOpen, setIsClockModalOpen] = useState<boolean>(false);
  const [isWizardModalOpen, setIsWizardModalOpen] = useState<boolean>(false);
  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState<boolean>(false);

  // Polling data
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [devRes, sessRes] = await Promise.all([
        apiRequest<{ devices: Device[] }>('/devices'),
        apiRequest<{ sessions: Session[] }>('/sessions?status=ACTIVE&limit=100')
      ]);

      setDevices(devRes.devices);
      setActiveSessions(sessRes.sessions);
    } catch (err: any) {
      if (err?.message?.includes('ავტორიზაცია') || err?.message?.includes('401')) {
        // Handled by AuthContext logout event
        return;
      }
      console.warn('Failed to poll dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(fetchData, 4000); // 4-sec background refresh for real-time synchronization
    return () => clearInterval(interval);
  }, [fetchData, user]);

  // Handler triggers
  const handleStartSession = (device: Device) => {
    setTargetDevice(device);
    setIsStartModalOpen(true);
  };

  const handleFinishSession = (session: Session) => {
    setTargetSession(session);
    setIsFinishModalOpen(true);
  };

  // თამაშის შეწყვეტა — გადახდის გარეშე ან ნაწილობრივი გადახდით
  const handleTerminateSession = (session: Session) => {
    setTargetSession(session);
    setIsTerminateModalOpen(true);
  };

  const handleExtendSession = (session: Session, minutes: number) => {
    setTargetSession(session);
    setExtendMinutes(minutes);
    setIsExtendModalOpen(true);
  };

  const handleUpdateExtras = (session: Session) => {
    setTargetSession(session);
    setIsExtrasModalOpen(true);
  };

  const handleToggleDeviceStatus = async (device: Device, newStatus: DeviceStatus) => {
    try {
      await apiRequest(`/devices/${device.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      sounds.playSuccessTone();
      fetchData();
    } catch (err: any) {
      alert(err.message || 'სტატუსის შეცვლა ვერ მოხერხდა.');
    }
  };

  const handleCancelSession = async (session: Session) => {
    const reason = window.prompt('სესია სრულად გაუქმდება (თითქოს არასდროს ყოფილა). მიზეზი:');
    if (reason === null) return;
    try {
      await apiRequest(`/sessions/${session.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'ოპერატორის მიერ გაუქმებული' })
      });
      sounds.playSuccessTone();
      fetchData();
    } catch (err: any) {
      alert(err.message || 'სესიის გაუქმება ვერ მოხერხდა.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenNewSession={() => { setTargetDevice(null); setIsStartModalOpen(true); }}
        onOpenTodaySales={() => setIsSalesModalOpen(true)}
        onOpenClockModal={() => setIsClockModalOpen(true)}
        onOpenWizardModal={() => setIsWizardModalOpen(true)}
        activeSessionsCount={activeSessions.length}
        totalDevicesCount={devices.length}
      />

      {/* Main Workspace Layout (Sidebar + Content View) */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeSessionsCount={activeSessions.length}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'PLAY_ROOM' && (
              <PlayRoomView
                devices={devices}
                sessions={activeSessions}
                onStartSession={handleStartSession}
                onFinishSession={handleFinishSession}
                onExtendSession={handleExtendSession}
                onUpdateExtras={handleUpdateExtras}
                onToggleStatus={handleToggleDeviceStatus}
                onCancelSession={handleCancelSession}
                onTerminateSession={handleTerminateSession}
                onOpenNewSession={() => { setTargetDevice(null); setIsStartModalOpen(true); }}
                onBookDevice={(device) => { setTargetDevice(device); setIsReservationModalOpen(true); }}
              />
            )}

            {activeTab === 'BOOKINGS' && (
              <BookingsView
                devices={devices}
                onOpenCreateModal={() => { setTargetDevice(null); setIsReservationModalOpen(true); }}
                onSessionStarted={fetchData}
              />
            )}

            {activeTab === 'SESSIONS' && (
              <SessionsView
                onFinishSession={handleFinishSession}
                onExtendSession={handleExtendSession}
                onCancelSession={handleCancelSession}
                onTerminateSession={handleTerminateSession}
                onRefreshDashboard={fetchData}
              />
            )}

            {activeTab === 'FINANCE' && (
              <FinanceView
                onOpenDailyClose={() => setIsCloseDayModalOpen(true)}
                onOpenTodaySales={() => setIsSalesModalOpen(true)}
              />
            )}

            {activeTab === 'REPORTS' && <ReportsView />}

            {activeTab === 'DISCOUNTS' && <DiscountsVouchersView />}

            {activeTab === 'TOURNAMENTS' && <TournamentsView />}

            {activeTab === 'STAFF' && <StaffPayrollView />}

            {activeTab === 'SETTINGS' && (
              <SettingsView onOpenWizard={() => setIsWizardModalOpen(true)} />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden bg-slate-900 border-t border-slate-800 flex items-center justify-around p-2 sticky bottom-0 z-40">
        <button
          onClick={() => setActiveTab('PLAY_ROOM')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeTab === 'PLAY_ROOM' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span>არენა</span>
        </button>

        <button
          onClick={() => setActiveTab('BOOKINGS')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeTab === 'BOOKINGS' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span>ჯავშნები</span>
        </button>

        <button
          onClick={() => setActiveTab('SESSIONS')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeTab === 'SESSIONS' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span>სესიები</span>
        </button>

        <button
          onClick={() => setActiveTab('FINANCE')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeTab === 'FINANCE' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <DollarSign className="w-5 h-5" />
          <span>სალარო</span>
        </button>

        <button
          onClick={() => setActiveTab('TOURNAMENTS')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeTab === 'TOURNAMENTS' ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span>ტურნირი</span>
        </button>
      </div>

      {/* All System Modals */}
      <StartSessionModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        devices={devices}
        initialDevice={targetDevice}
        onSessionStarted={fetchData}
      />

      <CreateReservationModal
        isOpen={isReservationModalOpen}
        onClose={() => setIsReservationModalOpen(false)}
        devices={devices}
        initialDevice={targetDevice}
        onReservationCreated={fetchData}
      />

      <FinishSessionModal
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        session={targetSession}
        onFinished={fetchData}
        canOverrideAmount={hasPermission('sessions.edit')}
      />

      <TerminateSessionModal
        isOpen={isTerminateModalOpen}
        onClose={() => setIsTerminateModalOpen(false)}
        session={targetSession}
        onTerminated={fetchData}
      />

      <ExtendSessionModal
        isOpen={isExtendModalOpen}
        onClose={() => setIsExtendModalOpen(false)}
        session={targetSession}
        initialMinutes={extendMinutes}
        onExtended={fetchData}
      />

      <UpdateExtrasModal
        isOpen={isExtrasModalOpen}
        onClose={() => setIsExtrasModalOpen(false)}
        session={targetSession}
        onUpdated={fetchData}
      />

      <TodaySalesModal
        isOpen={isSalesModalOpen}
        onClose={() => setIsSalesModalOpen(false)}
      />

      <ClockInOutModal
        isOpen={isClockModalOpen}
        onClose={() => setIsClockModalOpen(false)}
      />

      <SetupWizardModal
        isOpen={isWizardModalOpen}
        onClose={() => setIsWizardModalOpen(false)}
        onConfigured={fetchData}
      />

      <DailyCloseModal
        isOpen={isCloseDayModalOpen}
        onClose={() => setIsCloseDayModalOpen(false)}
        onClosed={fetchData}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
};

const AppRoot: React.FC = () => {
  const { user, loading } = useAuth();
  const [publicTournamentId, setPublicTournamentId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tournamentReg') || params.get('tournament') || params.get('reg');
    } catch {
      return null;
    }
  });

  // Listen to popstate or url changes
  useEffect(() => {
    const handleUrlCheck = () => {
      const params = new URLSearchParams(window.location.search);
      const tid = params.get('tournamentReg') || params.get('tournament') || params.get('reg');
      if (tid) setPublicTournamentId(tid);
    };
    window.addEventListener('popstate', handleUrlCheck);
    return () => window.removeEventListener('popstate', handleUrlCheck);
  }, []);

  if (publicTournamentId) {
    return (
      <PublicTournamentRegistrationView
        tournamentId={publicTournamentId}
        onGoToApp={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('tournamentReg');
          url.searchParams.delete('tournament');
          url.searchParams.delete('reg');
          window.history.pushState({}, '', url.pathname);
          setPublicTournamentId(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mb-3 animate-pulse">
          <Gamepad2 className="w-6 h-6 text-cyan-400" />
        </div>
        <p className="text-xs font-semibold tracking-wider">Play Room Arena იტვირთება...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <DashboardContent />;
};

export default App;
