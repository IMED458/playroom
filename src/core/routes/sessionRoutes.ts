import { Router, AppResponse as Response } from '../express';
import { queryAll, queryOne, execute, generateId } from '../db';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth';
import { calculatePrice, roundUpToIncrement, getSetting, getHourlyRate } from '../pricingService';
import { DeviceCategory, DeviceStatus, PaymentMethod, PaymentStatus, SessionStatus, Session } from '../../types';

export const sessionRouter = Router();

// Calculate live price preview
sessionRouter.post('/calculate-preview', authMiddleware, (req, res): void => {
  try {
    const {
      category,
      durationMinutes,
      extraControllersCount,
      manualDiscountAmount,
      manualDiscountReason,
      voucherCode,
      isFitPass,
      deviceId
    } = req.body;

    const result = calculatePrice({
      category: category as DeviceCategory,
      durationMinutes: Number(durationMinutes),
      extraControllersCount: Number(extraControllersCount || 0),
      manualDiscountAmount: Number(manualDiscountAmount || 0),
      manualDiscountReason,
      voucherCode,
      isFitPass: Boolean(isFitPass),
      deviceId
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'ფასის გამოთვლის შეცდომა.' });
  }
});

// Start new session (with race-condition / atomic lock prevention)
sessionRouter.post('/start', authMiddleware, requirePermission('sessions.create'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const {
      deviceId,
      durationMinutes,
      startTime: customStartTime,
      extraControllersCount = 0,
      manualDiscountAmount = 0,
      manualDiscountReason,
      voucherCode,
      isFitPass = false,
      paymentMethod = PaymentMethod.CASH,
      paymentStatus = PaymentStatus.PENDING,
      customerName,
      customerPhone,
      comment
    } = req.body;

    // isOpen — „მიმდინარე" სესია: დრო წინასწარ არ განისაზღვრება, თანხა დასრულებისას გამოითვლება
    const isOpenSession = Boolean(req.body.isOpen) || Number(durationMinutes) === 0;

    if (!deviceId) {
      res.status(400).json({ error: 'გთხოვთ აირჩიოთ მოწყობილობა.' });
      return;
    }

    if (!isOpenSession && !durationMinutes) {
      res.status(400).json({ error: 'გთხოვთ აირჩიოთ ხანგრძლივობა ან გაუშვათ „მიმდინარე" სესია.' });
      return;
    }

    // Atomic double-booking lock check
    const device = queryOne<{
      id: string;
      name: string;
      category: string;
      status: string;
      active: number;
      current_session_id: string | null;
    }>('SELECT * FROM devices WHERE id = ?', [deviceId]);

    if (!device || !device.active) {
      res.status(404).json({ error: 'მოწყობილობა ვერ მოიძებნა ან არააქტიურია.' });
      return;
    }

    if (device.status !== DeviceStatus.AVAILABLE || device.current_session_id) {
      res.status(409).json({ error: 'ეს მოწყობილობა უკვე დაკავებულია.' });
      return;
    }

    const sessionId = generateId('sess');
    const start = customStartTime ? new Date(customStartTime) : new Date();
    const now = new Date().toISOString();

    // Strict Backend Pricing Recalculation
    // ღია სესიაზე საწყისი გათვლა მინიმალურ დროზე კეთდება მხოლოდ ტარიფის დასაფიქსირებლად
    const openMinMinutes = parseInt(getSetting('openSessionMinMinutes', '30'), 10) || 30;
    const pricing = calculatePrice({
      category: device.category as DeviceCategory,
      durationMinutes: isOpenSession ? openMinMinutes : Number(durationMinutes),
      extraControllersCount: Number(extraControllersCount || 0),
      manualDiscountAmount: Number(manualDiscountAmount || 0),
      manualDiscountReason,
      voucherCode,
      isFitPass: Boolean(isFitPass),
      deviceId: device.id,
      allowFreeDuration: isOpenSession
    });

    // ღია სესია: წინასწარი თანხა არ ირიცხება
    const storedDuration = isOpenSession ? 0 : pricing.durationMinutes;
    const plannedEnd = isOpenSession
      ? start
      : new Date(start.getTime() + pricing.durationMinutes * 60000);
    const storedBasePrice = isOpenSession ? 0 : pricing.basePrice;
    const storedExtrasPrice = isOpenSession ? 0 : pricing.extraControllersPrice;
    const storedDiscount = isOpenSession ? 0 : pricing.discountAmount;
    const storedVoucherCovered = isOpenSession ? 0 : pricing.voucherCoveredAmount;
    const storedFitpassValue = isOpenSession ? 0 : pricing.fitPassRetailValue;
    const storedFinalPrice = isOpenSession ? 0 : pricing.finalPrice;
    const storedPaidAmount = isOpenSession ? 0 : pricing.customerPaidAmount;
    const effectivePaymentStatus = isOpenSession ? PaymentStatus.PENDING : paymentStatus;

    const operatorId = req.user!.id;
    const operatorName = req.user!.fullName;

    // If voucher used, mark voucher as USED
    if (pricing.voucherCode) {
      execute(`
        UPDATE vouchers
        SET status = 'USED', used_session_id = ?, used_by_id = ?, used_by_name = ?, used_at = ?
        WHERE code = ?
      `, [sessionId, operatorId, operatorName, now, pricing.voucherCode]);
    }

    // Insert Session
    execute(`
      INSERT INTO sessions (
        id, device_id, device_name, device_category, start_time, planned_duration_minutes, planned_end_time,
        actual_end_time, used_minutes, hourly_rate, base_price, discount_id, discount_name, discount_amount,
        manual_discount_reason, extra_controllers_count, extra_controllers_price, voucher_code, voucher_minutes,
        voucher_covered_amount, is_fitpass, fitpass_retail_value, final_price, customer_paid_amount,
        payment_method, payment_status, customer_name, customer_phone, comment, status,
        operator_id, operator_name, created_at, updated_at, is_open
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        NULL, 0, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, 'ACTIVE',
        ?, ?, ?, ?, ?
      )
    `, [
      sessionId, device.id, device.name, device.category, start.toISOString(), storedDuration, plannedEnd.toISOString(),
      pricing.hourlyRate, storedBasePrice, pricing.discountId || null, pricing.discountName || null, storedDiscount,
      pricing.manualDiscountReason || null, pricing.extraControllersCount, storedExtrasPrice, pricing.voucherCode || null, pricing.voucherMinutes,
      storedVoucherCovered, pricing.isFitPass ? 1 : 0, storedFitpassValue, storedFinalPrice, storedPaidAmount,
      isFitPass ? PaymentMethod.FITPASS : paymentMethod, effectivePaymentStatus, customerName || null, customerPhone || null, comment || null,
      operatorId, operatorName, now, now, isOpenSession ? 1 : 0
    ]);

    // Update Device Status
    execute(`
      UPDATE devices SET status = 'OCCUPIED', current_session_id = ?, updated_at = ? WHERE id = ?
    `, [sessionId, now, device.id]);

    // If prepaid immediately (and not 0 without reason), create transaction
    if (!isOpenSession && paymentStatus === PaymentStatus.PAID && pricing.customerPaidAmount > 0) {
      const txId = generateId('tx');
      execute(`
        INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
        VALUES (?, ?, ?, 'GAME_SESSION', ?, ?, ?, ?, ?, ?, ?)
      `, [
        txId,
        now.split('T')[0],
        new Date().toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        sessionId,
        pricing.customerPaidAmount,
        paymentMethod,
        operatorId,
        operatorName,
        `წინასწარი გადახდა: ${device.name} (${pricing.durationMinutes} წთ)`,
        now
      ]);
    }

    logAudit(req.user, 'START_SESSION', 'SESSION', sessionId, null, {
      device: device.name,
      duration: pricing.durationMinutes,
      finalPrice: pricing.finalPrice,
      customerPaid: pricing.customerPaidAmount,
      isFitPass: pricing.isFitPass,
      voucher: pricing.voucherCode
    }, req.ip);

    res.json({
      success: true,
      message: isOpenSession
        ? 'მიმდინარე სესია დაიწყო — თანხა დასრულებისას გამოითვლება.'
        : 'სესია წარმატებით დაიწყო.',
      sessionId,
      session: {
        id: sessionId,
        deviceId: device.id,
        deviceName: device.name,
        deviceCategory: device.category,
        startTime: start.toISOString(),
        plannedDurationMinutes: storedDuration,
        plannedEndTime: plannedEnd.toISOString(),
        isOpen: isOpenSession,
        finalPrice: storedFinalPrice,
        customerPaidAmount: storedPaidAmount,
        paymentStatus: effectivePaymentStatus,
        status: SessionStatus.ACTIVE
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'სესიის დაწყება ვერ მოხერხდა.' });
  }
});

// Extend session (+30m, +60m, etc.)
sessionRouter.post('/:id/extend', authMiddleware, requirePermission('sessions.edit'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { addMinutes } = req.body;

    const increment = parseInt(getSetting('timeIncrementMinutes', '30'), 10) || 30;
    const minutes = Number(addMinutes);
    if (!minutes || minutes <= 0 || minutes % increment !== 0) {
      res.status(400).json({ error: `დამატებითი დრო უნდა იყოს ${increment} წუთის ჯერადი.` });
      return;
    }

    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) {
      res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
      return;
    }

    if (session.status !== SessionStatus.ACTIVE) {
      res.status(400).json({ error: 'დროის დამატება შესაძლებელია მხოლოდ აქტიურ სესიაზე.' });
      return;
    }

    if (session.is_open) {
      res.status(400).json({ error: '„მიმდინარე" სესიას დროის დამატება არ სჭირდება — ის ისედაც უწყვეტად ითვლება.' });
      return;
    }

    const newTotalMinutes = session.planned_duration_minutes + minutes;

    // Recalculate price with new total duration
    const pricing = calculatePrice({
      category: session.device_category as DeviceCategory,
      durationMinutes: newTotalMinutes,
      extraControllersCount: session.extra_controllers_count,
      manualDiscountAmount: session.discount_amount,
      manualDiscountReason: session.manual_discount_reason,
      voucherCode: session.voucher_code,
      isFitPass: !!session.is_fitpass,
      deviceId: session.device_id,
      customHourlyRate: session.hourly_rate,
      recalcSessionId: id
    });

    const start = new Date(session.start_time);
    const newPlannedEnd = new Date(start.getTime() + newTotalMinutes * 60000);
    const now = new Date().toISOString();

    execute(`
      UPDATE sessions SET
        planned_duration_minutes = ?,
        planned_end_time = ?,
        base_price = ?,
        discount_amount = ?,
        extra_controllers_price = ?,
        voucher_covered_amount = ?,
        fitpass_retail_value = ?,
        final_price = ?,
        customer_paid_amount = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      newTotalMinutes,
      newPlannedEnd.toISOString(),
      pricing.basePrice,
      pricing.discountAmount,
      pricing.extraControllersPrice,
      pricing.voucherCoveredAmount,
      pricing.fitPassRetailValue,
      pricing.finalPrice,
      pricing.customerPaidAmount,
      now,
      id
    ]);

    logAudit(req.user, 'EXTEND_SESSION', 'SESSION', id, { previousMinutes: session.planned_duration_minutes }, { newTotalMinutes, added: minutes }, req.ip);

    res.json({
      success: true,
      message: `სესიას წარმატებით დაემატა ${minutes} წუთი.`,
      newTotalMinutes,
      newPlannedEndTime: newPlannedEnd.toISOString(),
      newFinalPrice: pricing.finalPrice,
      customerPaidAmount: pricing.customerPaidAmount
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'სესიის გაგრძელება ვერ მოხერხდა.' });
  }
});

// Update PlayStation Extra Controllers on active session
sessionRouter.post('/:id/update-extras', authMiddleware, requirePermission('sessions.edit'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { extraControllersCount } = req.body;

    const count = Math.max(0, Number(extraControllersCount || 0));

    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session || session.status !== SessionStatus.ACTIVE) {
      res.status(400).json({ error: 'სესია ვერ მოიძებნა ან არააქტიურია.' });
      return;
    }

    const pricing = calculatePrice({
      category: session.device_category as DeviceCategory,
      durationMinutes: session.is_open
        ? Math.max(1, Math.round((Date.now() - new Date(session.start_time).getTime()) / 60000))
        : session.planned_duration_minutes,
      extraControllersCount: count,
      manualDiscountAmount: session.discount_amount,
      manualDiscountReason: session.manual_discount_reason,
      voucherCode: session.voucher_code,
      isFitPass: !!session.is_fitpass,
      deviceId: session.device_id,
      customHourlyRate: session.hourly_rate,
      recalcSessionId: id,
      allowFreeDuration: !!session.is_open
    });

    const now = new Date().toISOString();
    execute(`
      UPDATE sessions SET
        extra_controllers_count = ?,
        extra_controllers_price = ?,
        final_price = ?,
        customer_paid_amount = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      count,
      session.is_open ? 0 : pricing.extraControllersPrice,
      session.is_open ? 0 : pricing.finalPrice,
      session.is_open ? 0 : pricing.customerPaidAmount,
      now,
      id
    ]);

    logAudit(req.user, 'UPDATE_SESSION_EXTRAS', 'SESSION', id, { previousCount: session.extra_controllers_count }, { count, extraPrice: pricing.extraControllersPrice }, req.ip);

    res.json({ success: true, extraControllersCount: count, extraControllersPrice: pricing.extraControllersPrice, finalPrice: pricing.finalPrice });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'კონტროლერების განახლება ვერ მოხერხდა.' });
  }
});


/**
 * საბოლოო ასაღები დროის გამოთვლა.
 * — „მიმდინარე" სესიაზე ითვლება რეალურად ნათამაშები დრო (მინიმალური ზღვრით),
 * — ფიქსირებულ სესიაზე გადაცილების შემთხვევაში ხდება დამრგვალება ინკრემენტამდე.
 */
function computeBilledMinutes(session: any, elapsedMinutes: number): number {
  const roundingMode = getSetting('roundingMode', 'ROUND_UP_30_MIN');
  const increment = parseInt(getSetting('timeIncrementMinutes', '30'), 10) || 30;

  if (session.is_open) {
    const minMinutes = parseInt(getSetting('openSessionMinMinutes', '30'), 10) || 30;
    const effective = Math.max(minMinutes, elapsedMinutes);
    return roundingMode === 'ROUND_UP_30_MIN' ? roundUpToIncrement(effective, increment) : effective;
  }

  if (roundingMode === 'ROUND_UP_30_MIN' && elapsedMinutes > session.planned_duration_minutes) {
    return roundUpToIncrement(elapsedMinutes, increment);
  }

  return session.planned_duration_minutes;
}

// მიმდინარე (ჯერ დაუსრულებელი) სესიის რეალურ დროზე გათვლილი მიმდინარე ღირებულება
sessionRouter.get('/:id/live-price', authMiddleware, (req, res): void => {
  try {
    const { id } = req.params;
    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) {
      res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
      return;
    }

    const elapsedMinutes = Math.max(1, Math.round((Date.now() - new Date(session.start_time).getTime()) / 60000));
    const billedMinutes = computeBilledMinutes(session, elapsedMinutes);

    const pricing = calculatePrice({
      category: session.device_category as DeviceCategory,
      durationMinutes: billedMinutes,
      extraControllersCount: session.extra_controllers_count,
      manualDiscountAmount: session.discount_amount,
      manualDiscountReason: session.manual_discount_reason,
      voucherCode: session.voucher_code,
      isFitPass: !!session.is_fitpass,
      deviceId: session.device_id,
      customHourlyRate: session.hourly_rate,
      recalcSessionId: id,
      allowFreeDuration: true
    });

    res.json({
      sessionId: id,
      isOpen: !!session.is_open,
      elapsedMinutes,
      billedMinutes,
      hourlyRate: session.hourly_rate,
      basePrice: pricing.basePrice,
      extraControllersPrice: pricing.extraControllersPrice,
      discountAmount: pricing.discountAmount,
      voucherCoveredAmount: pricing.voucherCoveredAmount,
      finalPrice: pricing.finalPrice,
      customerPaidAmount: pricing.customerPaidAmount
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'მიმდინარე ღირებულების გამოთვლა ვერ მოხერხდა.' });
  }
});

// Complete / Finish Session & Settle Payment
sessionRouter.post('/:id/finish', authMiddleware, requirePermission('sessions.finish'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const {
      paymentMethod = PaymentMethod.CASH,
      customerName,
      customerPhone,
      comment
    } = req.body;

    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) {
      res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
      return;
    }

    if (session.status !== SessionStatus.ACTIVE) {
      res.status(400).json({ error: 'სესია უკვე დასრულებულია ან გაუქმებულია.' });
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const startTime = new Date(session.start_time);
    const elapsedMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));

    const billedMinutes = computeBilledMinutes(session, elapsedMinutes);

    // Final price recalculation
    const pricing = calculatePrice({
      category: session.device_category as DeviceCategory,
      durationMinutes: billedMinutes,
      extraControllersCount: session.extra_controllers_count,
      manualDiscountAmount: session.discount_amount,
      manualDiscountReason: session.manual_discount_reason,
      voucherCode: session.voucher_code,
      isFitPass: !!session.is_fitpass,
      deviceId: session.device_id,
      customHourlyRate: session.hourly_rate,
      recalcSessionId: id,
      allowFreeDuration: true
    });

    const chosenPaymentMethod = session.is_fitpass ? PaymentMethod.FITPASS : paymentMethod;

    // ადმინს/ოპერატორს შეუძლია საბოლოო ასაღები თანხის ხელით კორექცია
    const overrideAmount = req.body.paidAmount;
    const paidAmount = overrideAmount !== undefined && overrideAmount !== null && !isNaN(Number(overrideAmount))
      ? Math.max(0, Math.round(Number(overrideAmount) * 100) / 100)
      : pricing.customerPaidAmount;
    const unpaidAmount = Math.max(0, Math.round((pricing.finalPrice - paidAmount) * 100) / 100);

    // Update Session to COMPLETED
    execute(`
      UPDATE sessions SET
        actual_end_time = ?,
        used_minutes = ?,
        planned_duration_minutes = ?,
        base_price = ?,
        discount_amount = ?,
        extra_controllers_price = ?,
        voucher_covered_amount = ?,
        fitpass_retail_value = ?,
        final_price = ?,
        customer_paid_amount = ?,
        unpaid_amount = ?,
        payment_method = ?,
        payment_status = ?,
        customer_name = COALESCE(?, customer_name),
        customer_phone = COALESCE(?, customer_phone),
        comment = COALESCE(?, comment),
        status = 'COMPLETED',
        updated_at = ?
      WHERE id = ?
    `, [
      nowIso,
      elapsedMinutes,
      billedMinutes,
      pricing.basePrice,
      pricing.discountAmount,
      pricing.extraControllersPrice,
      pricing.voucherCoveredAmount,
      pricing.fitPassRetailValue,
      pricing.finalPrice,
      paidAmount,
      unpaidAmount,
      chosenPaymentMethod,
      unpaidAmount > 0 ? 'PARTIAL' : 'PAID',
      customerName || null,
      customerPhone || null,
      comment || null,
      nowIso,
      id
    ]);

    // Free the device
    execute(`
      UPDATE devices SET status = 'AVAILABLE', current_session_id = NULL, updated_at = ? WHERE id = ?
    `, [nowIso, session.device_id]);

    // Create payment transaction record if not already prepaid
    const existingTx = queryOne('SELECT id FROM transactions WHERE source = ? AND source_id = ?', ['GAME_SESSION', id]);
    if (!existingTx && paidAmount > 0) {
      const txId = generateId('tx');
      execute(`
        INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
        VALUES (?, ?, ?, 'GAME_SESSION', ?, ?, ?, ?, ?, ?, ?)
      `, [
        txId,
        nowIso.split('T')[0],
        now.toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        id,
        paidAmount,
        chosenPaymentMethod,
        req.user!.id,
        req.user!.fullName,
        `${session.device_name} (${billedMinutes} წთ, ნამდვილი: ${elapsedMinutes} წთ)`,
        nowIso
      ]);
    }

    logAudit(req.user, 'FINISH_SESSION', 'SESSION', id, { status: 'ACTIVE' }, {
      status: 'COMPLETED',
      usedMinutes: elapsedMinutes,
      billedMinutes,
      finalPrice: pricing.finalPrice,
      customerPaidAmount: paidAmount,
      unpaidAmount,
      paymentMethod: chosenPaymentMethod
    }, req.ip);

    res.json({
      success: true,
      message: 'სესია წარმატებით დასრულდა და გადახდა დაფიქსირდა.',
      session: {
        id,
        usedMinutes: elapsedMinutes,
        billedMinutes,
        finalPrice: pricing.finalPrice,
        customerPaidAmount: paidAmount,
        unpaidAmount,
        paymentMethod: chosenPaymentMethod,
        status: SessionStatus.COMPLETED
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'სესიის დასრულება ვერ მოხერხდა.' });
  }
});

// Cancel Session
sessionRouter.post('/:id/cancel', authMiddleware, requirePermission('sessions.cancel'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) {
      res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
      return;
    }

    if (session.status === SessionStatus.CANCELLED) {
      res.status(400).json({ error: 'ეს სესია უკვე გაუქმებულია.' });
      return;
    }

    const now = new Date().toISOString();

    // If voucher was used, restore it to ACTIVE
    if (session.voucher_code) {
      execute(`
        UPDATE vouchers SET status = 'ACTIVE', used_session_id = NULL, used_by_id = NULL, used_by_name = NULL, used_at = NULL
        WHERE code = ?
      `, [session.voucher_code]);
    }

    // Cancel Session
    execute(`
      UPDATE sessions SET status = 'CANCELLED', payment_status = 'CANCELLED', comment = COALESCE(?, comment), updated_at = ?
      WHERE id = ?
    `, [reason ? `გაუქმების მიზეზი: ${reason}` : null, now, id]);

    // Free device
    execute(`
      UPDATE devices SET status = 'AVAILABLE', current_session_id = NULL, updated_at = ? WHERE id = ?
    `, [now, session.device_id]);

    // Delete or cancel transaction associated with this session so it won't inflate revenue
    execute(`DELETE FROM transactions WHERE source = 'GAME_SESSION' AND source_id = ?`, [id]);

    logAudit(req.user, 'CANCEL_SESSION', 'SESSION', id, session, { reason, status: 'CANCELLED' }, req.ip);

    res.json({ success: true, message: 'სესია წარმატებით გაუქმდა და მოწყობილობა გათავისუფლდა.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'სესიის გაუქმება ვერ მოხერხდა.' });
  }
});

// თამაშის შეწყვეტა — მოთამაშემ არ გადაიხადა / არ გადავახდევინეთ.
// სესია სრულდება, მოწყობილობა თავისუფლდება, გადაუხდელი თანხა ცალკე აღირიცხება.
sessionRouter.post('/:id/terminate', authMiddleware, requirePermission('sessions.cancel'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { reason, collectedAmount = 0, paymentMethod = PaymentMethod.CASH, writeOff = true } = req.body;

    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) {
      res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
      return;
    }
    if (session.status !== SessionStatus.ACTIVE) {
      res.status(400).json({ error: 'შეწყვეტა შესაძლებელია მხოლოდ აქტიურ სესიაზე.' });
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const elapsedMinutes = Math.max(1, Math.round((now.getTime() - new Date(session.start_time).getTime()) / 60000));
    const billedMinutes = computeBilledMinutes(session, elapsedMinutes);

    const pricing = calculatePrice({
      category: session.device_category as DeviceCategory,
      durationMinutes: billedMinutes,
      extraControllersCount: session.extra_controllers_count,
      manualDiscountAmount: session.discount_amount,
      manualDiscountReason: session.manual_discount_reason,
      voucherCode: session.voucher_code,
      isFitPass: !!session.is_fitpass,
      deviceId: session.device_id,
      customHourlyRate: session.hourly_rate,
      recalcSessionId: id,
      allowFreeDuration: true
    });

    const collected = Math.max(0, Math.round(Number(collectedAmount || 0) * 100) / 100);
    const dueAmount = pricing.finalPrice;
    const unpaid = Math.max(0, Math.round((dueAmount - collected) * 100) / 100);
    const paymentStatus = collected <= 0 ? 'UNPAID' : (unpaid > 0 ? 'PARTIAL' : 'PAID');

    execute(`
      UPDATE sessions SET
        actual_end_time = ?,
        used_minutes = ?,
        planned_duration_minutes = ?,
        base_price = ?,
        discount_amount = ?,
        extra_controllers_price = ?,
        voucher_covered_amount = ?,
        fitpass_retail_value = ?,
        final_price = ?,
        customer_paid_amount = ?,
        unpaid_amount = ?,
        payment_method = ?,
        payment_status = ?,
        terminated_reason = ?,
        status = 'COMPLETED',
        updated_at = ?
      WHERE id = ?
    `, [
      nowIso, elapsedMinutes, billedMinutes, pricing.basePrice, pricing.discountAmount,
      pricing.extraControllersPrice, pricing.voucherCoveredAmount, pricing.fitPassRetailValue,
      writeOff ? collected : dueAmount, collected, writeOff ? 0 : unpaid,
      paymentMethod, paymentStatus, reason || 'თამაში შეწყვეტილია', nowIso, id
    ]);

    execute(`UPDATE devices SET status = 'AVAILABLE', current_session_id = NULL, updated_at = ? WHERE id = ?`, [nowIso, session.device_id]);

    // მხოლოდ რეალურად ამოღებული თანხა ხვდება სალაროში
    execute(`DELETE FROM transactions WHERE source = 'GAME_SESSION' AND source_id = ?`, [id]);
    if (collected > 0) {
      execute(`
        INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
        VALUES (?, ?, ?, 'GAME_SESSION', ?, ?, ?, ?, ?, ?, ?)
      `, [
        generateId('tx'), nowIso.split('T')[0],
        now.toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        id, collected, paymentMethod, req.user!.id, req.user!.fullName,
        `შეწყვეტილი სესია: ${session.device_name} (${billedMinutes} წთ)`, nowIso
      ]);
    }

    logAudit(req.user, 'TERMINATE_SESSION', 'SESSION', id, session, {
      reason, elapsedMinutes, billedMinutes, dueAmount, collected, unpaid, writeOff
    }, req.ip);

    res.json({
      success: true,
      message: collected > 0
        ? `სესია შეწყდა. ამოღებულია ${collected.toFixed(2)} ₾.`
        : 'სესია შეწყდა გადახდის გარეშე.',
      dueAmount,
      collected,
      unpaidAmount: writeOff ? 0 : unpaid,
      writtenOff: writeOff ? unpaid : 0
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'სესიის შეწყვეტა ვერ მოხერხდა.' });
  }
});

// სესიის სრული რედაქტირება (ადმინი) — თანხების, დროისა და გადახდის ჩათვლით
sessionRouter.put('/:id', authMiddleware, requirePermission('sessions.edit'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const existing = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
      return;
    }

    const fields: Record<string, string> = {
      startTime: 'start_time',
      plannedDurationMinutes: 'planned_duration_minutes',
      plannedEndTime: 'planned_end_time',
      actualEndTime: 'actual_end_time',
      usedMinutes: 'used_minutes',
      hourlyRate: 'hourly_rate',
      basePrice: 'base_price',
      discountAmount: 'discount_amount',
      manualDiscountReason: 'manual_discount_reason',
      extraControllersCount: 'extra_controllers_count',
      extraControllersPrice: 'extra_controllers_price',
      finalPrice: 'final_price',
      customerPaidAmount: 'customer_paid_amount',
      unpaidAmount: 'unpaid_amount',
      paymentMethod: 'payment_method',
      paymentStatus: 'payment_status',
      customerName: 'customer_name',
      customerPhone: 'customer_phone',
      comment: 'comment',
      status: 'status'
    };

    const sets: string[] = [];
    const params: any[] = [];
    for (const [key, column] of Object.entries(fields)) {
      if (req.body[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(req.body[key] === '' ? null : req.body[key]);
      }
    }

    if (sets.length === 0) {
      res.status(400).json({ error: 'ცვლილებები არ არის მითითებული.' });
      return;
    }

    const nowIso = new Date().toISOString();
    sets.push('updated_at = ?');
    params.push(nowIso, id);

    execute(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`, params);

    const updated = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);

    // სესიის დახურვისას მოწყობილობა უნდა გათავისუფლდეს
    if (updated.status !== 'ACTIVE') {
      execute(`UPDATE devices SET status = 'AVAILABLE', current_session_id = NULL, updated_at = ? WHERE current_session_id = ?`, [nowIso, id]);
    }

    // დაკავშირებული ტრანზაქციის სინქრონიზაცია
    const tx = queryOne<any>(`SELECT * FROM transactions WHERE source = 'GAME_SESSION' AND source_id = ?`, [id]);
    if (updated.status === 'CANCELLED' || updated.customer_paid_amount <= 0) {
      if (tx) execute('DELETE FROM transactions WHERE id = ?', [tx.id]);
    } else if (tx) {
      execute('UPDATE transactions SET amount = ?, payment_method = ? WHERE id = ?', [
        updated.customer_paid_amount, updated.payment_method, tx.id
      ]);
    } else if (updated.status === 'COMPLETED' && updated.customer_paid_amount > 0) {
      execute(`
        INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
        VALUES (?, ?, ?, 'GAME_SESSION', ?, ?, ?, ?, ?, ?, ?)
      `, [
        generateId('tx'),
        (updated.actual_end_time || updated.start_time).split('T')[0],
        new Date().toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        id, updated.customer_paid_amount, updated.payment_method,
        req.user!.id, req.user!.fullName, `რედაქტირებული სესია: ${updated.device_name}`, nowIso
      ]);
    }

    logAudit(req.user, 'UPDATE_SESSION', 'SESSION', id, existing, req.body, req.ip);
    res.json({ success: true, message: 'სესია წარმატებით დარედაქტირდა.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'სესიის რედაქტირება ვერ მოხერხდა.' });
  }
});

// სესიის სრული წაშლა (ადმინი) — შესაბამისი ტრანზაქციითა და ვაუჩერის აღდგენით
sessionRouter.delete('/:id', authMiddleware, requirePermission('sessions.delete'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const session = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) {
      res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
      return;
    }

    const nowIso = new Date().toISOString();

    if (session.voucher_code) {
      execute(`
        UPDATE vouchers SET status = 'ACTIVE', used_session_id = NULL, used_by_id = NULL, used_by_name = NULL, used_at = NULL
        WHERE code = ? AND used_session_id = ?
      `, [session.voucher_code, id]);
    }

    execute(`DELETE FROM transactions WHERE source = 'GAME_SESSION' AND source_id = ?`, [id]);
    execute(`UPDATE devices SET status = 'AVAILABLE', current_session_id = NULL, updated_at = ? WHERE current_session_id = ?`, [nowIso, id]);
    execute('DELETE FROM sessions WHERE id = ?', [id]);

    logAudit(req.user, 'DELETE_SESSION', 'SESSION', id, session, null, req.ip);
    res.json({ success: true, message: 'სესია და მასთან დაკავშირებული ჩანაწერები წაიშალა.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'სესიის წაშლა ვერ მოხერხდა.' });
  }
});

// Get Sessions with full filtering & pagination
sessionRouter.get('/', authMiddleware, (req, res): void => {
  const {
    search,
    category,
    deviceId,
    status,
    paymentMethod,
    isFitPass,
    hasVoucher,
    startDate,
    endDate,
    page = '1',
    limit = '25'
  } = req.query;

  let query = 'SELECT * FROM sessions WHERE 1=1';
  const params: any[] = [];

  if (search) {
    query += ' AND (id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR device_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (category) {
    query += ' AND device_category = ?';
    params.push(category);
  }

  if (deviceId) {
    query += ' AND device_id = ?';
    params.push(deviceId);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (paymentMethod) {
    query += ' AND payment_method = ?';
    params.push(paymentMethod);
  }

  if (isFitPass === 'true' || isFitPass === '1') {
    query += ' AND is_fitpass = 1';
  }

  if (hasVoucher === 'true' || hasVoucher === '1') {
    query += ' AND voucher_code IS NOT NULL';
  }

  if (startDate) {
    query += ' AND start_time >= ?';
    params.push(`${startDate}T00:00:00.000Z`);
  }

  if (endDate) {
    query += ' AND start_time <= ?';
    params.push(`${endDate}T23:59:59.999Z`);
  }

  const countRow = queryOne<{ count: number }>(`SELECT count(*) as count FROM (${query})`, params);
  const total = countRow?.count || 0;

  query += ' ORDER BY created_at DESC';

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  query += ` LIMIT ${limitNum} OFFSET ${offset}`;

  const rows = queryAll<any>(query, params);

  const sessions: Session[] = rows.map(s => ({
    id: s.id,
    deviceId: s.device_id,
    deviceName: s.device_name,
    deviceCategory: s.device_category as DeviceCategory,
    startTime: s.start_time,
    plannedDurationMinutes: s.planned_duration_minutes,
    plannedEndTime: s.planned_end_time,
    actualEndTime: s.actual_end_time || undefined,
    usedMinutes: s.used_minutes,
    hourlyRate: s.hourly_rate,
    basePrice: s.base_price,
    discountId: s.discount_id || undefined,
    discountName: s.discount_name || undefined,
    discountAmount: s.discount_amount,
    manualDiscountReason: s.manual_discount_reason || undefined,
    extraControllersCount: s.extra_controllers_count,
    extraControllersPrice: s.extra_controllers_price,
    voucherCode: s.voucher_code || undefined,
    voucherMinutes: s.voucher_minutes,
    voucherCoveredAmount: s.voucher_covered_amount,
    isFitPass: !!s.is_fitpass,
    fitPassRetailValue: s.fitpass_retail_value,
    finalPrice: s.final_price,
    customerPaidAmount: s.customer_paid_amount,
    isOpen: !!s.is_open,
    unpaidAmount: s.unpaid_amount || 0,
    terminatedReason: s.terminated_reason || undefined,
    paymentMethod: s.payment_method,
    paymentStatus: s.payment_status,
    customerName: s.customer_name || undefined,
    customerPhone: s.customer_phone || undefined,
    comment: s.comment || undefined,
    status: s.status,
    operatorId: s.operator_id,
    operatorName: s.operator_name,
    createdAt: s.created_at,
    updatedAt: s.updated_at
  }));

  res.json({
    sessions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

// Device alias endpoints for backwards compatibility and resilient polling
sessionRouter.get('/devices', authMiddleware, (req, res): void => {
  const devices = queryAll<{
    id: string;
    name: string;
    category: string;
    order_index: number;
    status: string;
    notes: string | null;
    active: number;
    current_session_id: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM devices ORDER BY order_index ASC, name ASC');

  const activeSessions = queryAll<any>('SELECT * FROM sessions WHERE status = "ACTIVE"');
  const sessionMap = new Map<string, any>();
  activeSessions.forEach(s => sessionMap.set(s.id, s));

  const result = devices.map(d => {
    let currentSession = undefined;
    if (d.current_session_id && sessionMap.has(d.current_session_id)) {
      const s = sessionMap.get(d.current_session_id);
      currentSession = {
        id: s.id,
        deviceId: s.device_id,
        deviceName: s.device_name,
        deviceCategory: s.device_category,
        startTime: s.start_time,
        plannedDurationMinutes: s.planned_duration_minutes,
        plannedEndTime: s.planned_end_time,
        isOpen: !!s.is_open,
        actualEndTime: s.actual_end_time || undefined,
        usedMinutes: s.used_minutes,
        hourlyRate: s.hourly_rate,
        basePrice: s.base_price,
        discountAmount: s.discount_amount,
        extraControllersCount: s.extra_controllers_count,
        extraControllersPrice: s.extra_controllers_price,
        voucherCode: s.voucher_code || undefined,
        isFitPass: !!s.is_fitpass,
        finalPrice: s.final_price,
        customerPaidAmount: s.customer_paid_amount,
        paymentMethod: s.payment_method,
        paymentStatus: s.payment_status,
        customerName: s.customer_name || undefined,
        customerPhone: s.customer_phone || undefined,
        comment: s.comment || undefined,
        status: s.status
      };
    }

    return {
      id: d.id,
      name: d.name,
      category: d.category as DeviceCategory,
      orderIndex: d.order_index,
      status: d.status as DeviceStatus,
      notes: d.notes || undefined,
      active: !!d.active,
      currentSessionId: d.current_session_id || undefined,
      currentSession
    };
  });

  res.json({ devices: result });
});

sessionRouter.patch('/devices/:id/status', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const device = queryOne('SELECT * FROM devices WHERE id = ?', [id]);
  if (!device) {
    res.status(404).json({ error: 'მოწყობილობა ვერ მოიძებნა.' });
    return;
  }

  execute('UPDATE devices SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?', [
    status || null,
    notes !== undefined ? notes : null,
    new Date().toISOString(),
    id
  ]);

  logAudit(req.user, 'CHANGE_DEVICE_STATUS', 'DEVICE', id, (device as any).status, status, req.ip);

  res.json({ success: true, message: `სტატუსი განახლდა: ${status}` });
});

// Single Session details
sessionRouter.get('/:id', authMiddleware, (req, res): void => {
  const { id } = req.params;
  if (id === 'devices' || id === 'calculate-preview') {
    res.status(404).json({ error: 'არასწორი მარშრუტი.' });
    return;
  }

  const s = queryOne<any>('SELECT * FROM sessions WHERE id = ?', [id]);
  if (!s) {
    res.status(404).json({ error: 'სესია ვერ მოიძებნა.' });
    return;
  }

  res.json({ session: s });
});
