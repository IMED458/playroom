import { queryAll, queryOne } from './db.js';
import { DeviceCategory, DiscountType, ExtraPriceMode } from '../src/types.js';

export interface CalculatePriceParams {
  category: DeviceCategory;
  durationMinutes: number;
  extraControllersCount?: number;
  manualDiscountAmount?: number;
  manualDiscountReason?: string;
  voucherCode?: string;
  isFitPass?: boolean;
  deviceId?: string;
  customHourlyRate?: number;
  /** ღია („მიმდინარე") სესიისთვის — ხანგრძლივობა შეიძლება არ იყოს ინკრემენტის ჯერადი */
  allowFreeDuration?: boolean;
  /** არსებული სესიის გადაანგარიშებისას — ამ სესიაზე უკვე გახარჯული ვაუჩერი ვალიდურად ითვლება */
  recalcSessionId?: string;
}

export interface PricingResult {
  durationMinutes: number;
  hourlyRate: number;
  basePrice: number;
  extraControllersCount: number;
  extraControllersPrice: number;
  extraMode: ExtraPriceMode;
  extraUnitRate: number;
  discountId?: string;
  discountName?: string;
  discountAmount: number;
  manualDiscountReason?: string;
  voucherCode?: string;
  voucherMinutes: number;
  voucherCoveredAmount: number;
  isFitPass: boolean;
  fitPassRetailValue: number;
  finalPrice: number;
  customerPaidAmount: number;
  snapshot: {
    category: DeviceCategory;
    hourlyRate: number;
    durationMinutes: number;
    basePrice: number;
    extras: number;
    discount: number;
    voucher: number;
    final: number;
    calculatedAt: string;
  };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getSetting(key: string, fallback: string): string {
  const row = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? fallback;
}

export function getTimeIncrement(): number {
  const parsed = parseInt(getSetting('timeIncrementMinutes', '30'), 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : 30;
}

export function roundUpToIncrement(actualMinutes: number, increment = getTimeIncrement()): number {
  if (actualMinutes <= 0) return increment;
  return Math.ceil(actualMinutes / increment) * increment;
}

/** უკუთავსებადობა ძველ გამოძახებებთან */
export function roundUpTo30Minutes(actualMinutes: number): number {
  return roundUpToIncrement(actualMinutes);
}

export function getHourlyRate(category: DeviceCategory, deviceId?: string): number {
  if (deviceId) {
    const dev = queryOne<{ hourly_price: number | null }>(
      'SELECT hourly_price FROM devices WHERE id = ?',
      [deviceId]
    );
    if (dev && typeof dev.hourly_price === 'number' && dev.hourly_price > 0) {
      return dev.hourly_price;
    }
  }
  const row = queryOne<{ hourly_price: number }>(
    'SELECT hourly_price FROM device_prices WHERE category = ?',
    [category]
  );
  if (row && typeof row.hourly_price === 'number') {
    return row.hourly_price;
  }
  // Fallback defaults if not set in DB
  switch (category) {
    case DeviceCategory.PC: return 10.0;
    case DeviceCategory.PLAYSTATION: return 15.0;
    case DeviceCategory.WHEEL: return 20.0;
    default: return 10.0;
  }
}

export function getExtraControllerConfig(): { mode: ExtraPriceMode; price: number } {
  const modeRow = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['extraControllerMode']);
  const priceRow = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['extraControllerPrice']);

  const mode = (modeRow?.value === 'FIXED' ? ExtraPriceMode.FIXED : ExtraPriceMode.HOURLY);
  const price = priceRow ? parseFloat(priceRow.value) || 3.0 : 3.0;

  return { mode, price };
}

export function calculatePrice(params: CalculatePriceParams): PricingResult {
  const {
    category,
    durationMinutes,
    extraControllersCount = 0,
    manualDiscountAmount = 0,
    manualDiscountReason,
    voucherCode,
    isFitPass = false,
    deviceId,
    customHourlyRate,
    allowFreeDuration = false,
    recalcSessionId
  } = params;

  const increment = getTimeIncrement();

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('ხანგრძლივობა უნდა იყოს დადებითი რიცხვი.');
  }

  if (!allowFreeDuration && durationMinutes % increment !== 0) {
    throw new Error(`არჩეული ხანგრძლივობა უნდა იყოს ${increment} წუთის ჯერადი.`);
  }

  const hourlyRate = customHourlyRate ?? getHourlyRate(category, deviceId);
  const hours = durationMinutes / 60;
  const basePrice = round2(hourlyRate * hours);

  // Extra Controllers (PlayStation)
  let extraControllersPrice = 0;
  const extraConfig = getExtraControllerConfig();
  const validExtraCount = Math.max(0, extraControllersCount);

  if (category === DeviceCategory.PLAYSTATION && validExtraCount > 0) {
    if (extraConfig.mode === ExtraPriceMode.HOURLY) {
      extraControllersPrice = round2(validExtraCount * extraConfig.price * hours);
    } else {
      extraControllersPrice = round2(validExtraCount * extraConfig.price);
    }
  }

  // Automatic Discount rules evaluation
  let discountId: string | undefined;
  let discountName: string | undefined;
  let autoDiscountAmount = 0;

  const rules = queryAll<{
    id: string;
    name: string;
    device_category: string;
    min_duration_minutes: number;
    max_duration_minutes: number | null;
    discount_type: string;
    discount_value: number;
  }>(`
    SELECT id, name, device_category, min_duration_minutes, max_duration_minutes, discount_type, discount_value
    FROM discount_rules
    WHERE active = 1
      AND (device_category = ? OR device_category = 'ALL')
      AND min_duration_minutes <= ?
      AND (max_duration_minutes IS NULL OR max_duration_minutes >= ?)
    ORDER BY min_duration_minutes DESC
  `, [category, durationMinutes, durationMinutes]);

  for (const rule of rules) {
    let calculatedDiscount = 0;
    if (rule.discount_type === DiscountType.PERCENTAGE) {
      calculatedDiscount = round2(basePrice * (rule.discount_value / 100));
    } else {
      calculatedDiscount = round2(Math.min(basePrice, rule.discount_value));
    }

    if (calculatedDiscount > autoDiscountAmount) {
      autoDiscountAmount = calculatedDiscount;
      discountId = rule.id;
      discountName = rule.name;
    }
  }

  // Manual Discount override if provided
  let finalDiscountAmount = autoDiscountAmount;
  if (manualDiscountAmount > 0) {
    finalDiscountAmount = round2(Math.min(basePrice + extraControllersPrice, manualDiscountAmount));
    discountName = manualDiscountReason ? `ხელით ფასდაკლება (${manualDiscountReason})` : 'ხელით ფასდაკლება';
  }

  // Voucher Evaluation
  let voucherMinutes = 0;
  let voucherCoveredAmount = 0;
  let cleanVoucherCode: string | undefined;

  if (voucherCode && voucherCode.trim().length > 0) {
    const code = voucherCode.trim().toUpperCase();
    const voucher = queryOne<{
      id: string;
      code: string;
      duration_minutes: number;
      device_category: string;
      specific_device_id: string | null;
      status: string;
      used_session_id: string | null;
      expiration_date: string | null;
    }>(`SELECT * FROM vouchers WHERE code = ?`, [code]);

    if (!voucher) {
      throw new Error(`ვაუჩერი კოდით '${code}' ვერ მოიძებნა.`);
    }
    // მიმდინარე სესიის გადაანგარიშებისას იმავე სესიაზე მიბმული ვაუჩერი ვალიდურია
    const usedByThisSession = !!recalcSessionId && voucher.used_session_id === recalcSessionId;
    if (voucher.status !== 'ACTIVE' && !usedByThisSession) {
      throw new Error(`ვაუჩერი უკვე გამოყენებულია ან გაუქმებულია (სტატუსი: ${voucher.status}).`);
    }
    if (voucher.expiration_date && new Date(voucher.expiration_date) < new Date()) {
      throw new Error('ვაუჩერს ვადა გაუვიდა.');
    }
    if (voucher.device_category !== 'ALL' && voucher.device_category !== category) {
      throw new Error(`ეს ვაუჩერი განკუთვნილია მხოლოდ ${voucher.device_category} მოწყობილობებისთვის.`);
    }
    if (voucher.specific_device_id && deviceId && voucher.specific_device_id !== deviceId) {
      throw new Error('ეს ვაუჩერი განკუთვნილია მხოლოდ კონკრეტული მოწყობილობისთვის.');
    }

    cleanVoucherCode = voucher.code;
    voucherMinutes = Math.min(durationMinutes, voucher.duration_minutes);
    voucherCoveredAmount = round2(hourlyRate * (voucherMinutes / 60));
  }

  // Standard total before fitpass
  const subtotal = round2(basePrice + extraControllersPrice);
  const netAfterDiscountAndVoucher = Math.max(0, round2(subtotal - finalDiscountAmount - voucherCoveredAmount));

  let finalPrice = netAfterDiscountAndVoucher;
  let customerPaidAmount = finalPrice;
  let fitPassRetailValue = 0;

  if (isFitPass) {
    fitPassRetailValue = netAfterDiscountAndVoucher > 0 ? netAfterDiscountAndVoucher : basePrice;
    finalPrice = 0.0;
    customerPaidAmount = 0.0;
  }

  return {
    durationMinutes,
    hourlyRate,
    basePrice,
    extraControllersCount: validExtraCount,
    extraControllersPrice,
    extraMode: extraConfig.mode,
    extraUnitRate: extraConfig.price,
    discountId,
    discountName,
    discountAmount: finalDiscountAmount,
    manualDiscountReason,
    voucherCode: cleanVoucherCode,
    voucherMinutes,
    voucherCoveredAmount,
    isFitPass,
    fitPassRetailValue,
    finalPrice,
    customerPaidAmount,
    snapshot: {
      category,
      hourlyRate,
      durationMinutes,
      basePrice,
      extras: extraControllersPrice,
      discount: finalDiscountAmount,
      voucher: voucherCoveredAmount,
      final: finalPrice,
      calculatedAt: new Date().toISOString()
    }
  };
}
