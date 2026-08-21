import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { RoleName } from '../../types';
import {
  Settings,
  Shield,
  History,
  DollarSign,
  Gamepad2,
  Users,
  CheckCircle2,
  RefreshCw,
  Search,
  KeyRound,
  Wand2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Lock,
  Phone,
  Mail,
  UserCheck,
  UserX,
  Plus,
  Copy,
  Check
} from 'lucide-react';
import { sounds } from '../../lib/audio';
import { DatabaseBackupPanel } from '../DatabaseBackupPanel';

interface SettingsViewProps {
  onOpenWizard: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenWizard }) => {
  const [activeTab, setActiveTab] = useState<'PRICING' | 'DEVICES' | 'USERS' | 'AUDIT' | 'RBAC'>('PRICING');
  const [settings, setSettings] = useState<any>({});
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceModal, setDeviceModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditAction, setAuditAction] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Password visibility map (userId -> boolean)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Pricing form
  const [pricePc, setPricePc] = useState<number>(10);
  const [pricePs, setPricePs] = useState<number>(15);
  const [priceWheel, setPriceWheel] = useState<number>(20);
  const [priceController, setPriceController] = useState<number>(3);
  const [roundingMode, setRoundingMode] = useState<string>('ROUND_UP_30_MIN');
  const [timeIncrement, setTimeIncrement] = useState<number>(30);
  const [openSessionMin, setOpenSessionMin] = useState<number>(30);
  const [businessName, setBusinessName] = useState<string>('');
  // პერსონალის პროცენტული ანაზღაურება
  const [payoutEnabled, setPayoutEnabled] = useState<boolean>(true);
  const [payoutBase, setPayoutBase] = useState<string>('TOTAL_REVENUE');
  const [payoutDefaultPercent, setPayoutDefaultPercent] = useState<number>(5);
  const [payoutOnlyWorked, setPayoutOnlyWorked] = useState<boolean>(true);

  // New / Edit User Modal
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uShowPassword, setUShowPassword] = useState(false);
  const [uFullName, setUFullName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uRole, setURole] = useState<RoleName>(RoleName.OPERATOR);
  const [uActive, setUActive] = useState<boolean>(true);

  // Reset Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, uRes, dRes] = await Promise.all([
        apiRequest<{ settings: any }>('/settings'),
        apiRequest<{ users: any[] }>('/users'),
        apiRequest<{ devices: any[] }>('/devices').catch(() => ({ devices: [] }))
      ]);

      const st = sRes.settings || {};
      setSettings(st);
      setBusinessName(st.businessName || '');
      setPricePc(Number(st.pcHourlyPrice ?? 10));
      setPricePs(Number(st.psHourlyPrice ?? 15));
      setPriceWheel(Number(st.wheelHourlyPrice ?? 20));
      setPriceController(Number(st.extraControllerPrice ?? 3));
      setRoundingMode(st.roundingMode || 'ROUND_UP_30_MIN');
      setTimeIncrement(Number(st.timeIncrementMinutes ?? 30));
      setOpenSessionMin(Number(st.openSessionMinMinutes ?? 30));
      setPayoutEnabled(st.staffPayoutEnabled !== false);
      setPayoutBase(st.staffPayoutBase || 'TOTAL_REVENUE');
      setPayoutDefaultPercent(Number(st.staffPayoutDefaultPercent ?? 5));
      setPayoutOnlyWorked(st.staffPayoutOnlyWorkedShifts !== false);

      setUsers(uRes.users || []);
      setDevices(dRes.devices || []);
      fetchAudit();
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      const params = new URLSearchParams();
      if (auditSearch) params.append('search', auditSearch);
      if (auditAction) params.append('action', auditAction);
      params.append('limit', '50');
      const data = await apiRequest<{ logs: any[] }>(`/audit?${params.toString()}`);
      setAuditLogs(data.logs || []);
    } catch {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          businessName: businessName || undefined,
          pcHourlyPrice: pricePc,
          psHourlyPrice: pricePs,
          wheelHourlyPrice: priceWheel,
          extraControllerPrice: priceController,
          roundingMode,
          timeIncrementMinutes: timeIncrement,
          openSessionMinMinutes: openSessionMin,
          staffPayoutEnabled: payoutEnabled,
          staffPayoutBase: payoutBase,
          staffPayoutDefaultPercent: payoutDefaultPercent,
          staffPayoutOnlyWorkedShifts: payoutOnlyWorked
        })
      });

      sounds.playSuccessTone();
      setSuccessMsg('ტარიფები წარმატებით შეინახა!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'ტარიფების შენახვა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceModal) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const body = {
        name: deviceModal.data.name,
        category: deviceModal.data.category,
        notes: deviceModal.data.notes || null,
        orderIndex: Number(deviceModal.data.orderIndex) || 0,
        hourlyPrice: deviceModal.data.hourlyPrice === '' || deviceModal.data.hourlyPrice === null
          ? null
          : Number(deviceModal.data.hourlyPrice)
      };

      if (deviceModal.mode === 'create') {
        await apiRequest('/devices', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await apiRequest(`/devices/${deviceModal.data.id}`, { method: 'PUT', body: JSON.stringify(body) });
      }

      sounds.playSuccessTone();
      setDeviceModal(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'მოწყობილობის შენახვა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDevice = async (device: any) => {
    if (!window.confirm(`მოწყობილობა „${device.name}" წაიშლება. გავაგრძელოთ?`)) return;
    try {
      await apiRequest(`/devices/${device.id}`, { method: 'DELETE' });
      sounds.playSuccessTone();
      fetchData();
    } catch (err: any) {
      window.alert(err.message || 'წაშლა ვერ მოხერხდა.');
    }
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUUsername('');
    setUPassword('');
    setUFullName('');
    setUEmail('');
    setUPhone('');
    setURole(RoleName.OPERATOR);
    setUActive(true);
    setFormError(null);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setUUsername(user.username || '');
    setUPassword('');
    setUFullName(user.fullName || user.full_name || '');
    setUEmail(user.email || '');
    setUPhone(user.phone || '');
    setURole(user.role || RoleName.OPERATOR);
    setUActive(user.active !== false && user.active !== 0);
    setFormError(null);
    setShowUserModal(true);
  };

  const handleOpenResetPassword = (user: any) => {
    setPasswordTargetUser(user);
    setNewPassword('');
    setShowNewPassword(false);
    setFormError(null);
    setShowPasswordModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingUser) {
        // Update user
        await apiRequest(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            fullName: uFullName.trim(),
            email: uEmail.trim() || undefined,
            phone: uPhone.trim() || undefined,
            role: uRole,
            active: uActive
          })
        });
      } else {
        // Create user
        await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify({
            username: uUsername.trim(),
            password: uPassword,
            fullName: uFullName.trim(),
            email: uEmail.trim() || undefined,
            phone: uPhone.trim() || undefined,
            role: uRole
          })
        });
      }

      sounds.playSuccessTone();
      setShowUserModal(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'მომხმარებლის შენახვა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser?.id || !newPassword) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await apiRequest(`/users/${passwordTargetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          newPassword: newPassword.trim()
        })
      });

      sounds.playSuccessTone();
      setShowPasswordModal(false);
      fetchData();
      alert(`პაროლი მომხმარებლისთვის @${passwordTargetUser.username} წარმატებით განახლდა!`);
    } catch (err: any) {
      setFormError(err.message || 'პაროლის შეცვლა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`ნამდვილად გსურთ მომხმარებლის @${user.username} წაშლა?`)) return;
    try {
      await apiRequest(`/users/${user.id}`, { method: 'DELETE' });
      sounds.playSuccessTone();
      fetchData();
    } catch (err: any) {
      alert(err.message || 'მომხმარებლის წაშლა ვერ მოხერხდა.');
    }
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch.trim()) return true;
    const s = userSearch.toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(s) ||
      (u.username || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.phone || '').includes(s)
    );
  });

  return (
    <div id="settings-view-container" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <span>სისტემის პარამეტრები & მომხმარებლები</span>
          </h2>
          <p className="text-xs text-slate-400">ტარიფები, მომხმარებლების სრული მართვა, პაროლების რედაქტირება და აუდიტი</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-open-setup-wizard"
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold transition cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Setup Wizard</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <button
          id="tab-btn-pricing"
          onClick={() => setActiveTab('PRICING')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'PRICING' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          ტარიფები & ფასები
        </button>

        <button
          id="tab-btn-devices"
          onClick={() => setActiveTab('DEVICES')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'DEVICES' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          მოწყობილობები ({devices.length})
        </button>

        <button
          id="tab-btn-users"
          onClick={() => setActiveTab('USERS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'USERS' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>მომხმარებლების მართვა ({users.length})</span>
        </button>

        <button
          id="tab-btn-rbac"
          onClick={() => setActiveTab('RBAC')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'RBAC' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          წვდომის როლები (RBAC)
        </button>

        <button
          id="tab-btn-audit"
          onClick={() => setActiveTab('AUDIT')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'AUDIT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          აუდიტის ლოგები ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Pricing Form */}
      {activeTab === 'PRICING' && (
        <form onSubmit={handleSavePricing} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 max-w-2xl">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cyan-400 mb-1">PC ტარიფი (₾ / სთ) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={pricePc}
                onChange={e => setPricePc(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-purple-400 mb-1">PlayStation (₾ / სთ) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={pricePs}
                onChange={e => setPricePs(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">Wheel / საჭე (₾ / სთ) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={priceWheel}
                onChange={e => setPriceWheel(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-purple-300 mb-1">დამატებითი კონტროლერი (₾ / სთ)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={priceController}
                onChange={e => setPriceController(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cyan-300 mb-1">დროის ინკრემენტი (წუთი)</label>
              <input
                type="number"
                step="5"
                min="5"
                value={timeIncrement}
                onChange={e => setTimeIncrement(parseInt(e.target.value, 10) || 30)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">დამრგვალების რეჟიმი (Rounding Mode)</label>
            <select
              value={roundingMode}
              onChange={e => setRoundingMode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs cursor-pointer"
            >
              <option value="ROUND_UP_30_MIN">ზემოთ დამრგვალება ინკრემენტამდე — სტანდარტი</option>
              <option value="PREPAID_FIXED">ზუსტი დრო (დამრგვალების გარეშე)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-300 mb-1">
              „მიმდინარე" სესიის მინიმალური ასაღები დრო (წუთი)
            </label>
            <input
              type="number"
              step="5"
              min="0"
              value={openSessionMin}
              onChange={e => setOpenSessionMin(parseInt(e.target.value, 10) || 0)}
              className="w-full sm:w-48 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
            />
          </div>

          {/* პერსონალის პროცენტული ანაზღაურება */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              პერსონალის ანაზღაურება (დღის შემოსავლის პროცენტი)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">გამოთვლის ბაზა</label>
                <select
                  value={payoutBase}
                  onChange={e => setPayoutBase(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs cursor-pointer"
                >
                  <option value="TOTAL_REVENUE">დღის სრული შემოსავალი</option>
                  <option value="CASH_ONLY">მხოლოდ ნაღდი ანგარიშსწორება</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ნაგულისხმევი პროცენტი (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={payoutDefaultPercent}
                  onChange={e => setPayoutDefaultPercent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payoutEnabled}
                  onChange={e => setPayoutEnabled(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900"
                />
                <span>პროცენტული ანაზღაურება ჩართულია</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payoutOnlyWorked}
                  onChange={e => setPayoutOnlyWorked(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900"
                />
                <span>მხოლოდ იმ დღეს ნამუშევარ პერსონალზე</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 cursor-pointer"
            >
              {submitting ? 'ინახება...' : 'პარამეტრების შენახვა'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'PRICING' && <DatabaseBackupPanel />}

      {/* Tab: მოწყობილობების მართვა */}
      {activeTab === 'DEVICES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              თითოეულ მოწყობილობას შეიძლება ჰქონდეს ინდივიდუალური ტარიფი — ცარიელი ველი ნიშნავს ზონის საერთო ტარიფს.
            </p>
            <button
              type="button"
              onClick={() => setDeviceModal({
                mode: 'create',
                data: { name: '', category: 'PC', notes: '', orderIndex: devices.length + 1, hourlyPrice: '' }
              })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold cursor-pointer"
            >
              + ახალი მოწყობილობა
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 min-w-[640px]">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">დასახელება</th>
                  <th className="p-3">ზონა</th>
                  <th className="p-3 text-center">რიგი</th>
                  <th className="p-3 text-right">ტარიფი</th>
                  <th className="p-3 text-center">სტატუსი</th>
                  <th className="p-3 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {devices.length > 0 ? devices.map(d => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">
                      {d.name}
                      {d.notes && <span className="block text-[10px] text-slate-500">{d.notes}</span>}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">{d.category}</td>
                    <td className="p-3 text-center font-mono">{d.orderIndex}</td>
                    <td className="p-3 text-right font-mono text-emerald-400">
                      {(d.hourlyPrice ?? 0).toFixed(2)} ₾
                      {d.customHourlyPrice && <span className="block text-[9px] text-amber-400">ინდივიდუალური</span>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        d.status === 'AVAILABLE'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : d.status === 'OCCUPIED'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDeviceModal({
                            mode: 'edit',
                            data: {
                              id: d.id,
                              name: d.name,
                              category: d.category,
                              notes: d.notes || '',
                              orderIndex: d.orderIndex,
                              hourlyPrice: d.customHourlyPrice ?? ''
                            }
                          })}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold cursor-pointer"
                        >
                          რედაქტირება
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(d)}
                          className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 text-[11px] font-semibold cursor-pointer"
                        >
                          წაშლა
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">მოწყობილობები არ არის</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* მოწყობილობის მოდალი */}
      {deviceModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-8">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-bold text-white text-base">
                {deviceModal.mode === 'create' ? 'ახალი მოწყობილობა' : 'მოწყობილობის რედაქტირება'}
              </h3>
              <button type="button" onClick={() => setDeviceModal(null)} className="p-2 text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveDevice} className="p-5 space-y-3">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{formError}</div>
              )}

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">დასახელება *</label>
                <input
                  type="text"
                  required
                  value={deviceModal.data.name}
                  onChange={e => setDeviceModal({ ...deviceModal, data: { ...deviceModal.data, name: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">ზონა *</label>
                  <select
                    value={deviceModal.data.category}
                    onChange={e => setDeviceModal({ ...deviceModal, data: { ...deviceModal.data, category: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="PC">PC</option>
                    <option value="PLAYSTATION">PlayStation</option>
                    <option value="WHEEL">საჭე / Wheel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">რიგითობა</label>
                  <input
                    type="number"
                    value={deviceModal.data.orderIndex}
                    onChange={e => setDeviceModal({ ...deviceModal, data: { ...deviceModal.data, orderIndex: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">ინდივიდუალური ტარიფი (₾/სთ) — არასავალდებულო</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="ცარიელი = ზონის ტარიფი"
                  value={deviceModal.data.hourlyPrice}
                  onChange={e => setDeviceModal({ ...deviceModal, data: { ...deviceModal.data, hourlyPrice: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">შენიშვნა</label>
                <input
                  type="text"
                  value={deviceModal.data.notes}
                  onChange={e => setDeviceModal({ ...deviceModal, data: { ...deviceModal.data, notes: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeviceModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'ინახება...' : 'შენახვა'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Users Management (CRUD, Edit, Password Visibility & Reset) */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                id="input-search-users"
                type="text"
                placeholder="ძებნა სახელით, username-ით, ტელეფონით..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full bg-transparent text-white text-xs outline-none placeholder-slate-500"
              />
            </div>

            <button
              id="btn-add-new-user"
              onClick={handleOpenCreateUser}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ახალი მომხმარებლის რეგისტრაცია</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">მომხმარებელი</th>
                  <th className="p-3.5">კონტაქტი</th>
                  <th className="p-3.5">როლი</th>
                  <th className="p-3.5">პაროლი / მინიშნება</th>
                  <th className="p-3.5">სტატუსი</th>
                  <th className="p-3.5 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.map(u => {
                  const isPwVisible = visiblePasswords[u.id];
                  const passwordDisplay = u.passwordHint || u.password_hint || (u.username === 'admin' ? 'admin123' : u.username === 'operator' ? 'operator123' : '••••••••');

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-white text-sm">{u.fullName || u.full_name}</div>
                        <div className="text-cyan-400 font-mono text-xs">@{u.username}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-0.5 text-slate-300">
                          {u.phone && (
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <Phone className="w-3 h-3 text-slate-400" /> {u.phone}
                            </div>
                          )}
                          {u.email && (
                            <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                              <Mail className="w-3 h-3 text-slate-500" /> {u.email}
                            </div>
                          )}
                          {!u.phone && !u.email && <span className="text-slate-500">—</span>}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                          u.role === RoleName.SUPER_ADMIN
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : u.role === RoleName.ADMIN
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Password / Password Hint with Eye Toggle */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-200 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 min-w-[80px]">
                            {isPwVisible ? passwordDisplay : '••••••••'}
                          </span>
                          <button
                            id={`btn-toggle-pw-${u.id}`}
                            type="button"
                            title={isPwVisible ? 'პაროლის დამალვა' : 'პაროლის ნახვა'}
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition"
                          >
                            {isPwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {u.active !== false && u.active !== 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <UserCheck className="w-3 h-3" /> აქტიური
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                            <UserX className="w-3 h-3" /> დაბლოკილი
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Password */}
                          <button
                            id={`btn-reset-pw-${u.id}`}
                            title="პაროლის შეცვლა / აღდგენა"
                            onClick={() => handleOpenResetPassword(u)}
                            className="p-1.5 bg-slate-800 hover:bg-amber-600/20 text-slate-300 hover:text-amber-300 rounded-lg border border-slate-700 hover:border-amber-500/40 transition"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit User */}
                          <button
                            id={`btn-edit-user-${u.id}`}
                            title="მომხმარებლის რედაქტირება"
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1.5 bg-slate-800 hover:bg-cyan-600/20 text-slate-300 hover:text-cyan-300 rounded-lg border border-slate-700 hover:border-cyan-500/40 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          {u.username !== 'admin' && (
                            <button
                              id={`btn-delete-user-${u.id}`}
                              title="მომხმარებლის წაშლა"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 bg-slate-800 hover:bg-red-600/20 text-slate-300 hover:text-red-400 rounded-lg border border-slate-700 hover:border-red-500/40 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: RBAC Matrix */}
      {activeTab === 'RBAC' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white">როლებზე დაფუძნებული წვდომის მატრიცა (RBAC Matrix)</h3>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">მოდული / ფუნქცია</th>
                  <th className="p-3 text-center">OPERATOR</th>
                  <th className="p-3 text-center">ADMIN</th>
                  <th className="p-3 text-center">SUPER ADMIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  { feature: 'სესიის დაწყება / გაგრძელება / დასრულება', op: true, ad: true, sa: true },
                  { feature: 'დღის ნავაჭრის ნახვა (Today Sales)', op: true, ad: true, sa: true },
                  { feature: 'ცვლის დაწყება/დასრულება (Clock In/Out)', op: true, ad: true, sa: true },
                  { feature: 'ტურნირში მონაწილის რეგისტრაცია', op: true, ad: true, sa: true },
                  { feature: 'ვაუჩერების შემოწმება და გააქტიურება', op: true, ad: true, sa: true },
                  { feature: 'დღის დახურვა & სალაროს ჩაკეტვა', op: false, ad: true, sa: true },
                  { feature: 'გადახდების რედაქტირება & წაშლა', op: false, ad: true, sa: true },
                  { feature: 'ფასდაკლების წესების შექმნა/მართვა', op: false, ad: true, sa: true },
                  { feature: 'ფინანსური ანალიტიკა & პერიოდის ფილტრი', op: false, ad: true, sa: true },
                  { feature: 'თანამშრომლების ხელფასების უწყისი', op: false, ad: true, sa: true },
                  { feature: 'სისტემის ტარიფების შეცვლა', op: false, ad: false, sa: true },
                  { feature: 'მომხმარებლების & პაროლების მართვა', op: false, ad: false, sa: true },
                  { feature: 'სრული აუდიტის ლოგების ნახვა', op: false, ad: false, sa: true },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-3 font-medium text-white">{row.feature}</td>
                    <td className="p-3 text-center">
                      {row.op ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      {row.ad ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      {row.sa ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="ძებნა აუდიტის ლოგებში..."
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500 w-64"
            />
            <button
              onClick={fetchAudit}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              ფილტრი
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">თარიღი / დრო</th>
                  <th className="p-3">მომხმარებელი</th>
                  <th className="p-3">მოქმედება</th>
                  <th className="p-3">დეტალები</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-slate-400 text-[11px]">
                      {new Date(l.timestamp || l.created_at).toLocaleString('ka-GE')}
                    </td>
                    <td className="p-3 font-semibold text-white">{l.userName || l.user_name || 'System'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 font-mono">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 truncate max-w-sm">
                      {l.afterValue || l.entity || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New / Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                {editingUser ? `მომხმარებლის რედაქტირება: @${editingUser.username}` : 'ახალი მომხმარებლის რეგისტრაცია'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">სრული სახელი და გვარი *</label>
                <input
                  id="input-user-fullname"
                  type="text"
                  required
                  placeholder="მაგ: გიორგი ბერიძე"
                  value={uFullName}
                  onChange={e => setUFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Username (მომხმარებლის სახელი) *</label>
                  <input
                    id="input-user-username"
                    type="text"
                    required
                    placeholder="მაგ: gio_operator"
                    value={uUsername}
                    onChange={e => setUUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">ტელეფონი</label>
                  <input
                    id="input-user-phone"
                    type="tel"
                    placeholder="5XX XX XX XX"
                    value={uPhone}
                    onChange={e => setUPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">ელ-ფოსტა</label>
                  <input
                    id="input-user-email"
                    type="email"
                    placeholder="user@playroom.ge"
                    value={uEmail}
                    onChange={e => setUEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">პაროლი *</label>
                  <div className="relative">
                    <input
                      id="input-user-password"
                      type={uShowPassword ? 'text' : 'password'}
                      required
                      placeholder="მინიმუმ 4 სიმბოლო"
                      value={uPassword}
                      onChange={e => setUPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-white text-xs font-mono outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setUShowPassword(!uShowPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {uShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">სისტემური როლი (Role) *</label>
                <select
                  id="select-user-role"
                  value={uRole}
                  onChange={e => setURole(e.target.value as RoleName)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={RoleName.OPERATOR}>Operator (ოპერატორი - სესიები, რეგისტრაცია, გაყიდვები)</option>
                  <option value={RoleName.ADMIN}>Admin (ადმინისტრატორი - სალაროს ჩაკეტვა, გადახდების რედაქტირება)</option>
                  <option value={RoleName.SUPER_ADMIN}>Super Admin (სრული წვდომა - ტარიფები, იუზერები, აუდიტი)</option>
                </select>
              </div>

              {editingUser && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">ანგარიშის სტატუსი</span>
                    <span className="text-[11px] text-slate-400">დაბლოკვისას მომხმარებელი ვერ შევა სისტემაში</span>
                  </div>
                  <input
                    id="checkbox-user-active"
                    type="checkbox"
                    checked={uActive}
                    onChange={e => setUActive(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  id="btn-submit-save-user"
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'ინახება...' : editingUser ? 'მონაცემების განახლება' : 'მომხმარებლის შექმნა'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && passwordTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                პაროლის შეცვლა: @{passwordTargetUser.username}
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-xs text-slate-400 block">მომხმარებელი:</span>
                <span className="text-sm font-bold text-white">{passwordTargetUser.fullName || passwordTargetUser.full_name}</span>
                <span className="text-xs text-cyan-400 font-mono block">@{passwordTargetUser.username}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ახალი პაროლი *</label>
                <div className="relative">
                  <input
                    id="input-reset-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="შეიყვანეთ ახალი პაროლი"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-white text-xs font-mono outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  id="btn-submit-reset-password"
                  type="submit"
                  disabled={submitting || !newPassword}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'ინახება...' : 'პაროლის განახლება'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
