import { Router, Response } from 'express';
import { queryAll, queryOne, execute, generateId } from '../db.js';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth.js';
import { Device, DeviceCategory, DeviceStatus, Session } from '../../src/types.js';

export const deviceRouter = Router();

// Get all devices with their current active session (if any) and current pricing
deviceRouter.get('/', authMiddleware, (req, res): void => {
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

  const prices = queryAll<{ category: string; hourly_price: number }>('SELECT category, hourly_price FROM device_prices');
  const priceMap = new Map<string, number>();
  prices.forEach(p => priceMap.set(p.category, p.hourly_price));

  // Fetch active sessions for occupied devices
  const activeSessions = queryAll<any>(`
    SELECT * FROM sessions WHERE status = 'ACTIVE'
  `);
  const sessionMap = new Map<string, any>();
  activeSessions.forEach(s => sessionMap.set(s.id, s));

  const result: Device[] = devices.map(d => {
    let currentSession: Session | undefined = undefined;
    if (d.current_session_id && sessionMap.has(d.current_session_id)) {
      const s = sessionMap.get(d.current_session_id);
      currentSession = {
        id: s.id,
        deviceId: s.device_id,
        deviceName: s.device_name,
        deviceCategory: s.device_category as DeviceCategory,
        startTime: s.start_time,
        plannedDurationMinutes: s.planned_duration_minutes,
        plannedEndTime: s.planned_end_time,
        isOpen: !!s.is_open,
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
      currentSession,
      hourlyPrice: (typeof (d as any).hourly_price === 'number' && (d as any).hourly_price > 0)
        ? (d as any).hourly_price
        : (priceMap.get(d.category) || 10.0),
      customHourlyPrice: (typeof (d as any).hourly_price === 'number' && (d as any).hourly_price > 0)
        ? (d as any).hourly_price
        : undefined,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    };
  });

  res.json({ devices: result });
});

// Create new device
deviceRouter.post('/', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { name, category, notes, orderIndex, hourlyPrice } = req.body;
  if (!name || !category) {
    res.status(400).json({ error: 'გთხოვთ მიუთითოთ მოწყობილობის სახელი და კატეგორია.' });
    return;
  }

  const id = generateId(`dev_${category.toLowerCase()}`);
  const now = new Date().toISOString();
  const order = typeof orderIndex === 'number' ? orderIndex : 0;

  execute(`
    INSERT INTO devices (id, name, category, order_index, status, notes, active, hourly_price, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'AVAILABLE', ?, 1, ?, ?, ?)
  `, [id, name.trim(), category, order, notes || null, hourlyPrice ? Number(hourlyPrice) : null, now, now]);

  logAudit(req.user, 'CREATE_DEVICE', 'DEVICE', id, null, { name, category }, req.ip);

  res.json({ success: true, message: 'მოწყობილობა წარმატებით დაემატა.', deviceId: id });
});

// Device Category Pricing
deviceRouter.get('/prices', authMiddleware, (req, res): void => {
  const prices = queryAll('SELECT category, hourly_price FROM device_prices');
  res.json({ prices });
});

deviceRouter.put('/prices', authMiddleware, requirePermission('prices.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { pcPrice, psPrice, wheelPrice } = req.body;
  const now = new Date().toISOString();

  const oldPrices = queryAll('SELECT category, hourly_price FROM device_prices');

  if (typeof pcPrice === 'number' && pcPrice >= 0) {
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [
      DeviceCategory.PC, pcPrice, now
    ]);
  }
  if (typeof psPrice === 'number' && psPrice >= 0) {
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [
      DeviceCategory.PLAYSTATION, psPrice, now
    ]);
  }
  if (typeof wheelPrice === 'number' && wheelPrice >= 0) {
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [
      DeviceCategory.WHEEL, wheelPrice, now
    ]);
  }

  logAudit(req.user, 'UPDATE_PRICES', 'PRICING', 'CATEGORY_PRICES', oldPrices, { pcPrice, psPrice, wheelPrice }, req.ip);

  res.json({ success: true, message: 'საათობრივი ტარიფები წარმატებით განახლდა.' });
});

// მოწყობილობების თანმიმდევრობის შენახვა
deviceRouter.put('/reorder', authMiddleware, requirePermission('devices.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { order } = req.body as { order: { id: string; orderIndex: number }[] };
  if (!Array.isArray(order)) {
    res.status(400).json({ error: 'თანმიმდევრობის სია არასწორია.' });
    return;
  }
  const now = new Date().toISOString();
  order.forEach(o => execute('UPDATE devices SET order_index = ?, updated_at = ? WHERE id = ?', [Number(o.orderIndex) || 0, now, o.id]));
  logAudit(req.user, 'REORDER_DEVICES', 'DEVICE', null, null, { count: order.length }, req.ip);
  res.json({ success: true, message: 'თანმიმდევრობა შენახულია.' });
});

// Update device
deviceRouter.put('/:id', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { name, category, notes, orderIndex, hourlyPrice } = req.body;

  const existing = queryOne<any>('SELECT * FROM devices WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'მოწყობილობა ვერ მოიძებნა.' });
    return;
  }

  const now = new Date().toISOString();
  execute(`
    UPDATE devices SET name = ?, category = ?, notes = ?, order_index = ?, hourly_price = ?, updated_at = ?
    WHERE id = ?
  `, [
    name ?? existing.name,
    category ?? existing.category,
    notes !== undefined ? notes : existing.notes,
    orderIndex ?? existing.order_index ?? 0,
    hourlyPrice !== undefined ? (hourlyPrice === null || hourlyPrice === '' ? null : Number(hourlyPrice)) : existing.hourly_price,
    now,
    id
  ]);

  logAudit(req.user, 'UPDATE_DEVICE', 'DEVICE', id, existing, { name, category, notes, orderIndex }, req.ip);

  res.json({ success: true, message: 'მოწყობილობის მონაცემები განახლდა.' });
});

// Toggle maintenance status
deviceRouter.post('/:id/toggle-maintenance', authMiddleware, requirePermission('sessions.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const device = queryOne<{ status: string; current_session_id: string | null }>('SELECT status, current_session_id FROM devices WHERE id = ?', [id]);

  if (!device) {
    res.status(404).json({ error: 'მოწყობილობა ვერ მოიძებნა.' });
    return;
  }

  if (device.current_session_id && device.status === DeviceStatus.OCCUPIED) {
    res.status(400).json({ error: 'დაკავებული მოწყობილობის გამორთვა შეუძლებელია. ჯერ დაასრულეთ სესია.' });
    return;
  }

  const newStatus = device.status === DeviceStatus.MAINTENANCE ? DeviceStatus.AVAILABLE : DeviceStatus.MAINTENANCE;
  execute('UPDATE devices SET status = ?, updated_at = ? WHERE id = ?', [newStatus, new Date().toISOString(), id]);

  logAudit(req.user, 'TOGGLE_DEVICE_MAINTENANCE', 'DEVICE', id, device.status, newStatus, req.ip);

  res.json({ success: true, status: newStatus });
});

// Toggle Archive / Deactivate
deviceRouter.post('/:id/toggle-archive', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const device = queryOne<{ active: number; current_session_id: string | null }>('SELECT active, current_session_id FROM devices WHERE id = ?', [id]);

  if (!device) {
    res.status(404).json({ error: 'მოწყობილობა ვერ მოიძებნა.' });
    return;
  }

  if (device.current_session_id) {
    res.status(400).json({ error: 'მოწყობილობაზე მიმდინარეობს სესია. არქივაციამდე დაასრულეთ სესია.' });
    return;
  }

  const newActive = device.active ? 0 : 1;
  execute('UPDATE devices SET active = ?, updated_at = ? WHERE id = ?', [newActive, new Date().toISOString(), id]);

  logAudit(req.user, 'TOGGLE_DEVICE_ARCHIVE', 'DEVICE', id, device.active, newActive, req.ip);

  res.json({ success: true, active: !!newActive });
});

// მოწყობილობის წაშლა (ადმინი)
deviceRouter.delete('/:id', authMiddleware, requirePermission('devices.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const device = queryOne<any>('SELECT * FROM devices WHERE id = ?', [id]);
  if (!device) {
    res.status(404).json({ error: 'მოწყობილობა ვერ მოიძებნა.' });
    return;
  }

  if (device.current_session_id) {
    res.status(400).json({ error: 'მოწყობილობაზე მიმდინარეობს სესია — ჯერ დაასრულეთ ან შეწყვიტეთ იგი.' });
    return;
  }

  const { purge } = req.query;
  if (purge === 'true' || purge === '1') {
    execute('DELETE FROM sessions WHERE device_id = ?', [id]);
  }
  execute('DELETE FROM reservations WHERE device_id = ?', [id]);
  execute('DELETE FROM devices WHERE id = ?', [id]);

  logAudit(req.user, 'DELETE_DEVICE', 'DEVICE', id, device, null, req.ip);
  res.json({ success: true, message: 'მოწყობილობა წაიშალა.' });
});

