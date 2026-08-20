import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { DiscountRule, DiscountType, Voucher } from '../../types';
import {
  Tag,
  Ticket,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Percent,
  Clock,
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { sounds } from '../../lib/audio';

export const DiscountsVouchersView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DISCOUNTS' | 'VOUCHERS'>('DISCOUNTS');
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Discount Modal
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [dName, setDName] = useState('');
  const [dType, setDType] = useState<DiscountType>(DiscountType.PERCENTAGE);
  const [dValue, setDValue] = useState(10);
  const [dCategory, setDCategory] = useState<string>('ALL');
  const [dMinMinutes, setDMinMinutes] = useState(60);
  const [dMaxMinutes, setDMaxMinutes] = useState<number | ''>('');
  const [dDescription, setDDescription] = useState('');

  // Voucher Modal
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [vCode, setVCode] = useState('');
  const [vDuration, setVDuration] = useState(60);
  const [vCategory, setVCategory] = useState('ALL');
  const [vExpires, setVExpires] = useState('');
  const [vNotes, setVNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dRes, vRes] = await Promise.all([
        apiRequest<{ discounts: DiscountRule[] }>('/discounts').catch(() => ({ discounts: [] })),
        apiRequest<{ vouchers: Voucher[] }>('/vouchers').catch(() => ({ vouchers: [] }))
      ]);
      setDiscounts(dRes?.discounts || []);
      setVouchers(vRes?.vouchers || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/discounts', {
        method: 'POST',
        body: JSON.stringify({
          name: dName.trim(),
          description: dDescription.trim() || undefined,
          deviceCategory: dCategory,
          discountType: dType,
          discountValue: dValue,
          minDurationMinutes: dMinMinutes,
          maxDurationMinutes: dMaxMinutes === '' ? undefined : Number(dMaxMinutes)
        })
      });

      sounds.playSuccessTone();
      setShowDiscountModal(false);
      setDName('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'ფასდაკლების შექმნა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDiscount = async (id: string, current: boolean) => {
    try {
      await apiRequest(`/discounts/${id}/toggle-active`, { method: 'POST' });
      sounds.playSuccessTone();
      fetchData();
    } catch {}
  };

  const handleDeleteDiscount = async (id: string) => {
    if (!confirm('ნამდვილად გსურთ ფასდაკლების წესის წაშლა?')) return;
    try {
      await apiRequest(`/discounts/${id}`, { method: 'DELETE' });
      fetchData();
    } catch {}
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          code: vCode.trim() || undefined,
          durationMinutes: vDuration,
          deviceCategory: vCategory,
          expirationDate: vExpires || undefined,
          notes: vNotes.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      setShowVoucherModal(false);
      setVCode('');
      setVNotes('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'ვაუჩერის შექმნა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelVoucher = async (id: string) => {
    try {
      await apiRequest(`/vouchers/${id}/cancel`, { method: 'POST' });
      sounds.playSuccessTone();
      fetchData();
    } catch (err: any) {
      window.alert(err.message || 'გაუქმება ვერ მოხერხდა.');
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    if (!window.confirm('ვაუჩერი სამუდამოდ წაიშლება. გავაგრძელოთ?')) return;
    try {
      await apiRequest(`/vouchers/${id}`, { method: 'DELETE' });
      sounds.playSuccessTone();
      fetchData();
    } catch (err: any) {
      window.alert(err.message || 'წაშლა ვერ მოხერხდა.');
    }
  };

  const handleGenerateCode = () => {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    setVCode(`PR-${random}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400" />
            <span>ფასდაკლებები & ვაუჩერები (Discounts & Vouchers)</span>
          </h2>
          <p className="text-xs text-slate-400">Happy Hours, ხანგრძლივობის აქციები და სასაჩუქრე ვაუჩერები</p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'DISCOUNTS' ? (
            <button
              onClick={() => { setError(null); setShowDiscountModal(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ახალი ფასდაკლების წესი</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setError(null);
                handleGenerateCode();
                setShowVoucherModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ახალი ვაუჩერის გენერაცია</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('DISCOUNTS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'DISCOUNTS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          ფასდაკლების წესები ({discounts.length})
        </button>

        <button
          onClick={() => setActiveTab('VOUCHERS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'VOUCHERS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          ვაუჩერების ბაზა ({vouchers.length})
        </button>
      </div>

      {/* Tab 1: Discounts List */}
      {activeTab === 'DISCOUNTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discounts.map(d => (
            <div
              key={d.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                d.isActive
                  ? 'bg-slate-900 border-slate-700 shadow-lg'
                  : 'bg-slate-900/40 border-slate-800 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-white text-base">{d.name}</h3>
                    <span className="text-[11px] text-slate-400">
                      {d.type === DiscountType.PERCENTAGE ? `${d.value}% ფასდაკლება` : `${d.value} ₾ ფასდაკლება`}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    d.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {d.isActive ? 'აქტიური' : 'გათიშული'}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                  {d.startTime && d.endTime && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>საათები: {d.startTime} - {d.endTime}</span>
                    </div>
                  )}
                  {d.minHours && d.minHours > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>მინიმუმ {d.minHours} საათი</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleToggleDiscount(d.id, d.isActive)}
                  className={`text-xs font-semibold px-3 py-1 rounded-lg transition cursor-pointer ${
                    d.isActive
                      ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300'
                      : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300'
                  }`}
                >
                  {d.isActive ? 'გათიშვა' : 'ჩართვა'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteDiscount(d.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition cursor-pointer"
                  title="წაშლა"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Vouchers List */}
      {activeTab === 'VOUCHERS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">კოდი</th>
                  <th className="p-3">ხანგრძლივობა</th>
                  <th className="p-3">კატეგორია</th>
                  <th className="p-3">ვადა</th>
                  <th className="p-3">სტატუსი</th>
                  <th className="p-3">გამოყენების დრო / სესია</th>
                  <th className="p-3">შენიშვნა</th>
                  <th className="p-3 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {vouchers.map(v => (
                  <tr key={v.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-purple-300 text-sm">
                      {v.code}
                    </td>
                    <td className="p-3 font-mono font-semibold text-white">
                      {v.durationMinutes} წუთი
                    </td>
                    <td className="p-3 text-slate-400 font-mono">
                      {v.deviceCategory === 'ALL' || !v.deviceCategory ? 'ყველა (ALL)' : v.deviceCategory}
                    </td>
                    <td className="p-3 text-slate-400 font-mono">
                      {v.expirationDate ? new Date(v.expirationDate).toLocaleDateString('ka-GE') : 'ულიმიტო'}
                    </td>
                    <td className="p-3">
                      {v.status === 'ACTIVE' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          აქტიური
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                          {v.status === 'USED' ? 'გამოყენებული' : v.status}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {v.usedAt ? `${new Date(v.usedAt).toLocaleString('ka-GE')}` : '—'}
                    </td>
                    <td className="p-3 text-slate-400 truncate max-w-xs">{v.notes || '—'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {v.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => handleCancelVoucher(v.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold cursor-pointer"
                          >
                            გაუქმება
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteVoucher(v.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 cursor-pointer"
                          title="წაშლა"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base">ახალი ფასდაკლების წესი</h3>
              <button onClick={() => setShowDiscountModal(false)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDiscount} className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">დასახელება *</label>
                <input
                  type="text"
                  required
                  placeholder="მაგ: Happy Hours 20%"
                  value={dName}
                  onChange={e => setDName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">ტიპი</label>
                  <select
                    value={dType}
                    onChange={e => setDType(e.target.value as DiscountType)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                  >
                    <option value={DiscountType.PERCENTAGE}>პროცენტული (%)</option>
                    <option value={DiscountType.FIXED_AMOUNT}>ფიქსირებული (₾)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">მნიშვნელობა *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={dValue}
                    onChange={e => setDValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">ზონა</label>
                <select
                  value={dCategory}
                  onChange={e => setDCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="ALL">ყველა ზონა</option>
                  <option value="PC">PC</option>
                  <option value="PLAYSTATION">PlayStation</option>
                  <option value="WHEEL">საჭე / Wheel</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">მინ. ხანგრძლივობა (წთ) *</label>
                  <input
                    type="number"
                    min="30"
                    step="30"
                    required
                    value={dMinMinutes}
                    onChange={e => setDMinMinutes(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">მაქს. ხანგრძლივობა (წთ)</label>
                  <input
                    type="number"
                    min="0"
                    step="30"
                    placeholder="ულიმიტო"
                    value={dMaxMinutes}
                    onChange={e => setDMaxMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">აღწერა</label>
                <input
                  type="text"
                  placeholder="მაგ: 3 საათი ან მეტი PC-ზე"
                  value={dDescription}
                  onChange={e => setDDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'იქმნება...' : 'წესის შენახვა'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base">ახალი ვაუჩერის შექმნა</h3>
              <button onClick={() => setShowVoucherModal(false)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-400">ვაუჩერის კოდი *</label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-[11px] text-purple-400 hover:underline cursor-pointer"
                  >
                    გენერაცია
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="PR-XXXXXX"
                  value={vCode}
                  onChange={e => setVCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono uppercase outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">ხანგრძლივობა (წუთი) *</label>
                  <input
                    type="number"
                    step="30"
                    min="30"
                    required
                    value={vDuration}
                    onChange={e => setVDuration(parseInt(e.target.value, 10) || 60)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">ვადა (Expires At)</label>
                  <input
                    type="date"
                    value={vExpires}
                    onChange={e => setVExpires(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">შენიშვნა / კამპანია</label>
                <input
                  type="text"
                  placeholder="მაგ: Facebook Giveaway გამარჯვებული"
                  value={vNotes}
                  onChange={e => setVNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'იქმნება...' : 'ვაუჩერის გამოშვება'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
