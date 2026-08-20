import React, { useState, useEffect, useMemo } from 'react';
import { Device, DeviceCategory, PaymentMethod, PaymentStatus, PriceCalculationResult } from '../types';
import { apiRequest } from '../lib/api';
import {
  X,
  Play,
  Monitor,
  Gamepad2,
  Disc,
  Ticket,
  Sparkles,
  Percent,
  Infinity as InfinityIcon,
  AlertCircle,
  Lock
} from 'lucide-react';
import { sounds } from '../lib/audio';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  initialDevice?: Device | null;
  onSessionStarted: () => void;
}

const DURATION_PRESETS = [
  { label: '30 წთ', minutes: 30 },
  { label: '1 სთ', minutes: 60 },
  { label: '1.5 სთ', minutes: 90 },
  { label: '2 სთ', minutes: 120 },
  { label: '3 სთ', minutes: 180 },
  { label: '4 სთ', minutes: 240 },
  { label: '5 სთ', minutes: 300 },
];

/** მოწყობილობები ჯგუფდება ზონების მიხედვით: PC, PlayStation, საჭე */
const CATEGORY_GROUPS: {
  category: DeviceCategory;
  label: string;
  icon: React.ElementType;
  accent: string;
  activeClass: string;
}[] = [
  {
    category: DeviceCategory.PC,
    label: 'PC ზონა',
    icon: Monitor,
    accent: 'text-cyan-400',
    activeClass: 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
  },
  {
    category: DeviceCategory.PLAYSTATION,
    label: 'PlayStation',
    icon: Gamepad2,
    accent: 'text-purple-400',
    activeClass: 'bg-purple-500/20 border-purple-500 text-purple-200'
  },
  {
    category: DeviceCategory.WHEEL,
    label: 'საჭე / Racing',
    icon: Disc,
    accent: 'text-amber-400',
    activeClass: 'bg-amber-500/20 border-amber-500 text-amber-200'
  }
];

export const StartSessionModal: React.FC<StartSessionModalProps> = ({
  isOpen,
  onClose,
  devices,
  initialDevice,
  onSessionStarted
}) => {
  useBodyScrollLock(isOpen);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isOpenSession, setIsOpenSession] = useState<boolean>(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [extraControllersCount, setExtraControllersCount] = useState<number>(0);
  const [isFitPass, setIsFitPass] = useState<boolean>(false);
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherValidated, setVoucherValidated] = useState<boolean>(false);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);
  const [manualDiscountAmount, setManualDiscountAmount] = useState<number>(0);
  const [manualDiscountReason, setManualDiscountReason] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PENDING);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [comment, setComment] = useState<string>('');

  const [preview, setPreview] = useState<PriceCalculationResult | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ფორმის განულება ყოველ გახსნაზე
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPreview(null);
    setIsOpenSession(false);
    setDurationMinutes(60);
    setExtraControllersCount(0);
    setIsFitPass(false);
    setVoucherCode('');
    setVoucherValidated(false);
    setVoucherMessage(null);
    setManualDiscountAmount(0);
    setManualDiscountReason('');
    setPaymentMethod(PaymentMethod.CASH);
    setPaymentStatus(PaymentStatus.PENDING);
    setCustomerName('');
    setCustomerPhone('');
    setComment('');

    if (initialDevice) {
      setSelectedDeviceId(initialDevice.id);
    } else {
      const firstAvail = devices.find(d => d.status === 'AVAILABLE');
      setSelectedDeviceId(firstAvail ? firstAvail.id : '');
    }
  }, [isOpen, initialDevice]);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  const grouped = useMemo(() => {
    return CATEGORY_GROUPS.map(group => ({
      ...group,
      devices: devices
        .filter(d => d.category === group.category && d.active !== false)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name))
    })).filter(g => g.devices.length > 0);
  }, [devices]);

  // ფასის ცოცხალი გათვლა (ღია სესიაზე თანხა ბოლოს განისაზღვრება)
  useEffect(() => {
    if (!isOpen || !selectedDevice || isOpenSession) {
      if (isOpenSession) setPreview(null);
      return;
    }

    let cancelled = false;
    const fetchPreview = async () => {
      try {
        const data = await apiRequest<PriceCalculationResult>('/sessions/calculate-preview', {
          method: 'POST',
          body: JSON.stringify({
            category: selectedDevice.category,
            durationMinutes,
            extraControllersCount,
            manualDiscountAmount,
            manualDiscountReason,
            voucherCode: voucherValidated ? voucherCode : undefined,
            isFitPass,
            deviceId: selectedDevice.id
          })
        });
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreview(null);
      }
    };

    fetchPreview();
    return () => { cancelled = true; };
  }, [
    isOpen,
    selectedDeviceId,
    isOpenSession,
    durationMinutes,
    extraControllersCount,
    manualDiscountAmount,
    manualDiscountReason,
    voucherCode,
    voucherValidated,
    isFitPass
  ]);

  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) return;
    setError(null);
    try {
      const data = await apiRequest<{ valid: boolean; voucher: any; error?: string }>(`/vouchers/check/${voucherCode.trim()}`);
      if (data.valid) {
        setVoucherValidated(true);
        setVoucherMessage(`ვაუჩერი დადასტურდა: ${data.voucher.durationMinutes} წუთი`);
        sounds.playSuccessTone();
      } else {
        setVoucherValidated(false);
        setVoucherMessage(data.error || 'ვაუჩერი არავალიდურია');
      }
    } catch (err: any) {
      setVoucherValidated(false);
      setVoucherMessage(err.message || 'ვაუჩერი ვერ მოიძებნა');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      setError('გთხოვთ აირჩიოთ მოწყობილობა.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await apiRequest('/sessions/start', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          isOpen: isOpenSession,
          durationMinutes: isOpenSession ? 0 : durationMinutes,
          extraControllersCount,
          manualDiscountAmount: isOpenSession ? 0 : manualDiscountAmount,
          manualDiscountReason: manualDiscountReason.trim() || undefined,
          voucherCode: voucherValidated ? voucherCode.trim() : undefined,
          isFitPass,
          paymentMethod: isFitPass ? PaymentMethod.FITPASS : paymentMethod,
          paymentStatus: isOpenSession ? PaymentStatus.PENDING : paymentStatus,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          comment: comment.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      onSessionStarted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'სესიის დაწყება ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ახალი სათამაშო სესია</h2>
              <p className="text-xs text-slate-400">აირჩიეთ ზონა, მოწყობილობა და ხანგრძლივობა</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. მოწყობილობის არჩევა — ზონების მიხედვით დაჯგუფებული */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              მოწყობილობის არჩევა *
            </label>

            {grouped.map(group => {
              const Icon = group.icon;
              const freeCount = group.devices.filter(d => d.status === 'AVAILABLE').length;
              return (
                <div key={group.category} className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <Icon className={`w-4 h-4 ${group.accent}`} />
                      <span>{group.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {freeCount} / {group.devices.length} თავისუფალი
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
                    {group.devices.map(d => {
                      const isFree = d.status === 'AVAILABLE';
                      const isSelected = selectedDeviceId === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={!isFree}
                          onClick={() => setSelectedDeviceId(d.id)}
                          className={`px-2 py-2 rounded-lg border text-[11px] font-semibold transition text-left flex flex-col gap-0.5 ${
                            isSelected
                              ? group.activeClass
                              : isFree
                              ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600 cursor-pointer'
                              : 'bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            {!isFree && <Lock className="w-3 h-3 shrink-0" />}
                            <span className="truncate">{d.name}</span>
                          </span>
                          <span className="font-mono text-[10px] opacity-70">
                            {isFree ? `${(d.hourlyPrice ?? 0).toFixed(2)} ₾/სთ` : 'დაკავებული'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. ხანგრძლივობა — „მიმდინარე" ან ფიქსირებული */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                სესიის ხანგრძლივობა *
              </label>
              <span className="text-xs font-bold text-cyan-400 font-mono">
                {isOpenSession
                  ? 'დრო შეუზღუდავია'
                  : `${durationMinutes} წუთი (${(durationMinutes / 60).toFixed(1)} სთ)`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setIsOpenSession(true)}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  isOpenSession
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-emerald-500/50'
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" />
                <span>მიმდინარე</span>
              </button>

              {DURATION_PRESETS.map(p => (
                <button
                  key={p.minutes}
                  type="button"
                  onClick={() => { setIsOpenSession(false); setDurationMinutes(p.minutes); }}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    !isOpenSession && durationMinutes === p.minutes
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {isOpenSession ? (
              <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start gap-2">
                <InfinityIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  სესია გაეშვება ტაიმერით და დრო წინასწარ არ იზღუდება.
                  გადასახდელი თანხა ავტომატურად გამოითვლება რეალურად ნათამაშები დროის მიხედვით, დასრულებისას.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="30"
                  min="30"
                  max="1440"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Math.max(30, parseInt(e.target.value, 10) || 30))}
                  className="w-32 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-cyan-500"
                />
                <span className="text-xs text-slate-400">წუთი (30 წუთის ჯერადი)</span>
              </div>
            )}
          </div>

          {/* 3. დამატებითი კონტროლერები */}
          {selectedDevice?.category === DeviceCategory.PLAYSTATION && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                  <Gamepad2 className="w-4 h-4" />
                  <span>დამატებითი კონტროლერები (DualSense):</span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-300">+{extraControllersCount} ცალი</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setExtraControllersCount(count)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      extraControllersCount === count
                        ? 'bg-purple-500/30 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-purple-500/40'
                    }`}
                  >
                    {count === 0 ? 'სტანდარტული (0)' : `+${count}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. FitPass & ვაუჩერი */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>FitPass სესია</span>
                </div>
                <p className="text-[11px] text-slate-400">კლიენტის გადასახდელი = 0 ₾</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFitPass}
                  onChange={e => setIsFitPass(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <label className="text-xs font-bold text-purple-300 mb-1 flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-purple-400" />
                <span>ვაუჩერის კოდი</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={e => {
                    setVoucherCode(e.target.value.toUpperCase());
                    setVoucherValidated(false);
                  }}
                  placeholder="PR-XXXXXX"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono uppercase outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleValidateVoucher}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  შემოწმება
                </button>
              </div>
              {voucherMessage && (
                <p className={`text-[10px] mt-1 ${voucherValidated ? 'text-emerald-400' : 'text-red-400'}`}>
                  {voucherMessage}
                </p>
              )}
            </div>
          </div>

          {/* 5. ხელით ფასდაკლება */}
          {!isOpenSession && (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ხელით ფასდაკლება (არასავალდებულო):</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="თანხა ₾ (მაგ: 5)"
                  value={manualDiscountAmount || ''}
                  onChange={e => setManualDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  placeholder="ფასდაკლების მიზეზი (აუდიტისთვის)"
                  value={manualDiscountReason}
                  onChange={e => setManualDiscountReason(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 6. კლიენტი */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">მოთამაშის სახელი</label>
              <input
                type="text"
                placeholder="მაგ: გიორგი"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">ტელეფონის ნომერი</label>
              <input
                type="tel"
                placeholder="5XX XX XX XX"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">კომენტარი</label>
              <input
                type="text"
                placeholder="მაგ: CS2 გუნდი"
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 7. გადახდა */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">გადახდის მეთოდი</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                disabled={isFitPass}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
              >
                <option value={PaymentMethod.CASH}>ნაღდი (CASH)</option>
                <option value={PaymentMethod.CARD}>ბარათი (CARD)</option>
                <option value={PaymentMethod.TRANSFER}>გადმორიცხვა (TRANSFER)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">გადახდის სტატუსი</label>
              <select
                value={isOpenSession ? PaymentStatus.PENDING : paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
                disabled={isOpenSession}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
              >
                <option value={PaymentStatus.PENDING}>გადახდა სესიის ბოლოს</option>
                <option value={PaymentStatus.PAID}>წინასწარ გადახდილი</option>
              </select>
            </div>
          </div>

          {/* 8. გათვლა */}
          {!isOpenSession && preview && (
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>საბაზისო ტარიფი ({preview.hourlyRate} ₾/სთ × {(preview.durationMinutes / 60).toFixed(1)} სთ):</span>
                <span className="font-mono text-slate-200">{preview.basePrice.toFixed(2)} ₾</span>
              </div>

              {preview.discountAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-400">
                  <span>ფასდაკლება ({preview.discountName || 'ავტომატური/ხელით'}):</span>
                  <span className="font-mono font-semibold">-{preview.discountAmount.toFixed(2)} ₾</span>
                </div>
              )}

              {preview.extraControllersPrice > 0 && (
                <div className="flex items-center justify-between text-xs text-purple-400">
                  <span>დამატებითი კონტროლერები:</span>
                  <span className="font-mono font-semibold">+{preview.extraControllersPrice.toFixed(2)} ₾</span>
                </div>
              )}

              {preview.voucherCoveredAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-purple-300">
                  <span>ვაუჩერით დაფარული ({preview.voucherCode}):</span>
                  <span className="font-mono font-semibold">-{preview.voucherCoveredAmount.toFixed(2)} ₾</span>
                </div>
              )}

              {preview.isFitPass && (
                <div className="flex items-center justify-between text-xs text-cyan-400">
                  <span>FitPass (ნომინალი {preview.fitPassRetailValue.toFixed(2)} ₾):</span>
                  <span className="font-mono font-semibold">0.00 ₾</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-white">სულ გადასახდელი:</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  {preview.customerPaidAmount.toFixed(2)} ₾
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              გაუქმება
            </button>

            <button
              type="submit"
              disabled={submitting || !selectedDeviceId}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg flex items-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
                isOpenSession
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-600/25'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/25'
              }`}
            >
              {isOpenSession ? <InfinityIcon className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>
                {submitting
                  ? 'სესია იწყება...'
                  : isOpenSession
                  ? 'მიმდინარე სესიის გაშვება'
                  : 'სესიის დაწყება'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
