import { Router, AppResponse as Response } from '../express';
import { queryAll, queryOne, execute, generateId } from '../db';
import { AuthenticatedRequest, authMiddleware, logAudit } from '../auth';
import { Reservation, ReservationStatus, Device, DeviceStatus, SessionStatus, PaymentMethod, PaymentStatus } from '../../types';

export const reservationRouter = Router();

// GET /api/reservations - List all reservations with optional filters
reservationRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { date, status, deviceId } = req.query;

  let sql = `
    SELECT 
      id,
      device_id as deviceId,
      device_name as deviceName,
      device_category as deviceCategory,
      customer_name as customerName,
      customer_phone as customerPhone,
      start_time as startTime,
      end_time as endTime,
      deposit_amount as depositAmount,
      notes,
      status,
      created_by_id as createdById,
      created_by_name as createdByName,
      created_at as createdAt,
      updated_at as updatedAt
    FROM reservations
    WHERE 1=1
  `;
  const params: any[] = [];

  if (date) {
    sql += ` AND start_time LIKE ?`;
    params.push(`${date}%`);
  }

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (deviceId) {
    sql += ` AND device_id = ?`;
    params.push(deviceId);
  }

  sql += ` ORDER BY start_time ASC`;

  const rows = queryAll<Reservation>(sql, params);
  res.json({ reservations: rows });
});

// GET /api/reservations/:id
reservationRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const row = queryOne<Reservation>(`
    SELECT 
      id,
      device_id as deviceId,
      device_name as deviceName,
      device_category as deviceCategory,
      customer_name as customerName,
      customer_phone as customerPhone,
      start_time as startTime,
      end_time as endTime,
      deposit_amount as depositAmount,
      notes,
      status,
      created_by_id as createdById,
      created_by_name as createdByName,
      created_at as createdAt,
      updated_at as updatedAt
    FROM reservations
    WHERE id = ?
  `, [req.params.id]);

  if (!row) {
    res.status(404).json({ error: 'ჯავშანი ვერ მოიძებნა.' });
    return;
  }

  res.json({ reservation: row });
});

// POST /api/reservations - Create a new booking
reservationRouter.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const {
    deviceId,
    customerName,
    customerPhone,
    startTime,
    endTime,
    depositAmount,
    notes,
    status
  } = req.body;

  if (!deviceId || !customerName || !customerPhone || !startTime) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ მოწყობილობა, მომხმარებლის სახელი, ტელეფონი და დაწყების დრო.' });
    return;
  }

  const device = queryOne<{ id: string; name: string; category: string }>(
    'SELECT id, name, category FROM devices WHERE id = ?',
    [deviceId]
  );

  if (!device) {
    res.status(404).json({ error: 'არჩეული მოწყობილობა ვერ მოიძებნა.' });
    return;
  }

  const id = generateId('res');
  const now = new Date().toISOString();
  const resStatus = status || ReservationStatus.CONFIRMED;
  const deposit = Number(depositAmount) || 0;

  execute(`
    INSERT INTO reservations (
      id, device_id, device_name, device_category,
      customer_name, customer_phone, start_time, end_time,
      deposit_amount, notes, status, created_by_id, created_by_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    device.id,
    device.name,
    device.category,
    customerName.trim(),
    customerPhone.trim(),
    startTime,
    endTime || null,
    deposit,
    notes ? notes.trim() : null,
    resStatus,
    req.user?.id || 'system',
    req.user?.fullName || 'ადმინი',
    now,
    now
  ]);

  // If deposit > 0, record a financial transaction
  if (deposit > 0) {
    const txId = generateId('tx');
    const today = now.split('T')[0];
    const timeStr = now.split('T')[1].substring(0, 8);

    execute(`
      INSERT INTO transactions (
        id, date, time, source, source_id, amount, payment_method,
        created_by_id, created_by_name, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      txId,
      today,
      timeStr,
      'MANUAL_INCOME',
      id,
      deposit,
      'CASH',
      req.user?.id || 'system',
      req.user?.fullName || 'ადმინი',
      `წინასწარი ჯავშნის დეპოზიტი: ${customerName} (${device.name})`,
      now
    ]);
  }

  logAudit(
    req.user,
    'CREATE_RESERVATION',
    'RESERVATION',
    id,
    null,
    `ჯავშანი: ${device.name} - ${customerName} (${startTime})`,
    req.ip
  );

  const created = queryOne<Reservation>(`
    SELECT 
      id,
      device_id as deviceId,
      device_name as deviceName,
      device_category as deviceCategory,
      customer_name as customerName,
      customer_phone as customerPhone,
      start_time as startTime,
      end_time as endTime,
      deposit_amount as depositAmount,
      notes,
      status,
      created_by_id as createdById,
      created_by_name as createdByName,
      created_at as createdAt,
      updated_at as updatedAt
    FROM reservations
    WHERE id = ?
  `, [id]);

  res.status(201).json({ success: true, reservation: created });
});

// PUT /api/reservations/:id - Update booking
reservationRouter.put('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const {
    deviceId,
    customerName,
    customerPhone,
    startTime,
    endTime,
    depositAmount,
    notes,
    status
  } = req.body;

  const existing = queryOne<Reservation>('SELECT * FROM reservations WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჯავშანი ვერ მოიძებნა.' });
    return;
  }

  let deviceName = (existing as any).device_name;
  let deviceCategory = (existing as any).device_category;

  if (deviceId && deviceId !== (existing as any).device_id) {
    const dev = queryOne<{ id: string; name: string; category: string }>('SELECT id, name, category FROM devices WHERE id = ?', [deviceId]);
    if (dev) {
      deviceName = dev.name;
      deviceCategory = dev.category;
    }
  }

  const now = new Date().toISOString();

  execute(`
    UPDATE reservations SET
      device_id = COALESCE(?, device_id),
      device_name = COALESCE(?, device_name),
      device_category = COALESCE(?, device_category),
      customer_name = COALESCE(?, customer_name),
      customer_phone = COALESCE(?, customer_phone),
      start_time = COALESCE(?, start_time),
      end_time = ?,
      deposit_amount = COALESCE(?, deposit_amount),
      notes = ?,
      status = COALESCE(?, status),
      updated_at = ?
    WHERE id = ?
  `, [
    deviceId || null,
    deviceName || null,
    deviceCategory || null,
    customerName ? customerName.trim() : null,
    customerPhone ? customerPhone.trim() : null,
    startTime || null,
    endTime || null,
    depositAmount !== undefined ? Number(depositAmount) : null,
    notes ? notes.trim() : null,
    status || null,
    now,
    id
  ]);

  logAudit(
    req.user,
    'UPDATE_RESERVATION',
    'RESERVATION',
    id,
    JSON.stringify(existing),
    JSON.stringify(req.body),
    req.ip
  );

  res.json({ success: true, message: 'ჯავშანი წარმატებით განახლდა.' });
});

// PATCH /api/reservations/:id/status - Update reservation status
reservationRouter.patch('/:id/status', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ error: 'სტატუსი სავალდებულოა.' });
    return;
  }

  const existing = queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჯავშანი ვერ მოიძებნა.' });
    return;
  }

  execute('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    new Date().toISOString(),
    id
  ]);

  logAudit(req.user, 'CHANGE_RESERVATION_STATUS', 'RESERVATION', id, (existing as any).status, status, req.ip);

  res.json({ success: true, message: `ჯავშნის სტატუსი შეიცვალა: ${status}` });
});

// POST /api/reservations/:id/convert-to-session - Convert reservation to active playing session
reservationRouter.post('/:id/convert-to-session', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { durationMinutes = 60, extraControllers = 0, paymentMethod = PaymentMethod.CASH } = req.body;

  const resRow = queryOne<any>('SELECT * FROM reservations WHERE id = ?', [id]);
  if (!resRow) {
    res.status(404).json({ error: 'ჯავშანი ვერ მოიძებნა.' });
    return;
  }

  const device = queryOne<{ id: string; name: string; category: string; status: string }>(
    'SELECT id, name, category, status FROM devices WHERE id = ?',
    [resRow.device_id]
  );

  if (!device) {
    res.status(404).json({ error: 'მოწყობილობა ვერ მოიძებნა.' });
    return;
  }

  if (device.status === 'OCCUPIED') {
    res.status(400).json({ error: `მოწყობილობა '${device.name}' უკვე დაკავებულია სხვა აქტიური სესიით.` });
    return;
  }

  const sessionId = generateId('sess');
  const now = new Date();
  const startTime = now.toISOString();
  const plannedDuration = Number(durationMinutes) || 60;
  const plannedEnd = new Date(now.getTime() + plannedDuration * 60000).toISOString();

  // Get price for category
  const priceRow = queryOne<{ hourly_price: number }>('SELECT hourly_price FROM device_prices WHERE category = ?', [device.category]);
  const hourlyRate = priceRow ? priceRow.hourly_price : 15.0;

  const basePrice = (plannedDuration / 60) * hourlyRate;
  const deposit = Number(resRow.deposit_amount) || 0;
  const finalPrice = Math.max(0, basePrice - deposit);

  execute(`
    INSERT INTO sessions (
      id, device_id, device_name, device_category, start_time,
      planned_duration_minutes, planned_end_time, used_minutes,
      hourly_rate, base_price, discount_amount, manual_discount_reason,
      extra_controllers_count, extra_controllers_price,
      final_price, customer_paid_amount, payment_method, payment_status,
      customer_name, customer_phone, comment, status,
      operator_id, operator_name, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, 0,
      ?, ?, ?, ?,
      ?, 0,
      ?, 0, ?, 'PENDING',
      ?, ?, ?, 'ACTIVE',
      ?, ?, ?, ?
    )
  `, [
    sessionId,
    device.id,
    device.name,
    device.category,
    startTime,
    plannedDuration,
    plannedEnd,
    hourlyRate,
    basePrice,
    deposit,
    deposit > 0 ? `ჯავშნის დეპოზიტი (${deposit} ₾)` : null,
    Number(extraControllers) || 0,
    finalPrice,
    paymentMethod,
    resRow.customer_name,
    resRow.customer_phone,
    `ჯავშნიდან გადაყვანილი (#${id}): ${resRow.notes || ''}`.trim(),
    req.user?.id || 'system',
    req.user?.fullName || 'ოპერატორი',
    startTime,
    startTime
  ]);

  // Update device status
  execute('UPDATE devices SET status = ?, current_session_id = ?, updated_at = ? WHERE id = ?', [
    DeviceStatus.OCCUPIED,
    sessionId,
    startTime,
    device.id
  ]);

  // Mark reservation converted
  execute('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?', [
    ReservationStatus.CONVERTED,
    startTime,
    id
  ]);

  logAudit(
    req.user,
    'CONVERT_RESERVATION_TO_SESSION',
    'SESSION',
    sessionId,
    `ჯავშანი: ${id}`,
    `სესია დაიწყო: ${device.name} (${resRow.customer_name})`,
    req.ip
  );

  res.json({
    success: true,
    message: 'სესია წარმატებით დაიწყო ჯავშნიდან!',
    sessionId,
    deviceId: device.id
  });
});

// DELETE /api/reservations/:id
reservationRouter.delete('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჯავშანი ვერ მოიძებნა.' });
    return;
  }

  execute('DELETE FROM reservations WHERE id = ?', [id]);

  logAudit(req.user, 'DELETE_RESERVATION', 'RESERVATION', id, JSON.stringify(existing), null, req.ip);

  res.json({ success: true, message: 'ჯავშანი წარმატებით წაიშალა.' });
});
