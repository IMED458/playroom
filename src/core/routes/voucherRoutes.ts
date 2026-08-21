import { Router, AppResponse as Response } from '../express';
import { queryAll, queryOne, execute, generateId } from '../db';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth';
import { Voucher, VoucherStatus } from '../../types';

export const voucherRouter = Router();

// Get all vouchers
voucherRouter.get('/', authMiddleware, (req, res): void => {
  const rows = queryAll<any>('SELECT * FROM vouchers ORDER BY created_at DESC');
  const vouchers: Voucher[] = rows.map(v => ({
    id: v.id,
    code: v.code,
    durationMinutes: v.duration_minutes,
    deviceCategory: v.device_category,
    specificDeviceId: v.specific_device_id || undefined,
    status: v.status as VoucherStatus,
    createdById: v.created_by_id,
    createdByName: v.created_by_name,
    usedSessionId: v.used_session_id || undefined,
    usedById: v.used_by_id || undefined,
    usedByName: v.used_by_name || undefined,
    usedAt: v.used_at || undefined,
    expirationDate: v.expiration_date || undefined,
    notes: v.notes || undefined,
    createdAt: v.created_at
  }));
  res.json({ vouchers });
});

// Check/Validate single voucher code (Public and authenticated)
voucherRouter.get('/check/:code', (req, res): void => {
  const { code } = req.params;
  if (!code || code.trim().length === 0) {
    res.status(400).json({ valid: false, error: 'ვაუჩერის კოდი ცარიელია.' });
    return;
  }
  const v = queryOne<any>('SELECT * FROM vouchers WHERE code = ?', [code.trim().toUpperCase()]);

  if (!v) {
    res.status(404).json({ valid: false, error: 'ვაუჩერი ვერ მოიძებნა.' });
    return;
  }

  if (v.status !== 'ACTIVE') {
    res.status(400).json({ valid: false, error: `ვაუჩერი უკვე გამოყენებულია ან გაუქმებულია (სტატუსი: ${v.status}).` });
    return;
  }

  if (v.expiration_date && new Date(v.expiration_date) < new Date()) {
    res.status(400).json({ valid: false, error: 'ვაუჩერს ვადა გაუვიდა.' });
    return;
  }

  res.json({
    valid: true,
    voucher: {
      id: v.id,
      code: v.code,
      durationMinutes: v.duration_minutes,
      deviceCategory: v.device_category,
      specificDeviceId: v.specific_device_id,
      status: v.status,
      expirationDate: v.expiration_date
    }
  });
});

// Create new voucher
voucherRouter.post('/', authMiddleware, requirePermission('vouchers.create'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    code: customCode,
    durationMinutes,
    deviceCategory = 'ALL',
    specificDeviceId,
    expirationDate,
    notes
  } = req.body;

  const duration = Number(durationMinutes);
  if (!duration || duration <= 0 || duration % 30 !== 0) {
    res.status(400).json({ error: 'ვაუჩერის ხანგრძლივობა უნდა იყოს 30 წუთის ჯერადი.' });
    return;
  }

  const code = (customCode && customCode.trim().length > 0)
    ? customCode.trim().toUpperCase()
    : `PR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Check unique
  const exists = queryOne('SELECT id FROM vouchers WHERE code = ?', [code]);
  if (exists) {
    res.status(400).json({ error: `ვაუჩერი კოდით '${code}' უკვე არსებობს.` });
    return;
  }

  const id = generateId('vouch');
  const now = new Date().toISOString();

  execute(`
    INSERT INTO vouchers (
      id, code, duration_minutes, device_category, specific_device_id,
      status, created_by_id, created_by_name, expiration_date, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
  `, [
    id, code, duration, deviceCategory, specificDeviceId || null,
    req.user!.id, req.user!.fullName, expirationDate || null, notes || null, now
  ]);

  logAudit(req.user, 'CREATE_VOUCHER', 'VOUCHER', id, null, { code, duration, deviceCategory }, req.ip);

  res.json({ success: true, message: 'ვაუჩერი წარმატებით შეიქმნა.', voucher: { id, code, durationMinutes: duration } });
});

// Cancel / Deactivate Voucher
voucherRouter.post('/:id/cancel', authMiddleware, requirePermission('vouchers.create'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const voucher = queryOne<any>('SELECT * FROM vouchers WHERE id = ?', [id]);

  if (!voucher) {
    res.status(404).json({ error: 'ვაუჩერი ვერ მოიძებნა.' });
    return;
  }

  if (voucher.status === 'USED') {
    res.status(400).json({ error: 'უკვე გამოყენებული ვაუჩერის გაუქმება შეუძლებელია.' });
    return;
  }

  execute(`UPDATE vouchers SET status = 'CANCELLED' WHERE id = ?`, [id]);
  logAudit(req.user, 'CANCEL_VOUCHER', 'VOUCHER', id, voucher, { status: 'CANCELLED' }, req.ip);

  res.json({ success: true, message: 'ვაუჩერი გაუქმდა.' });
});

// ვაუჩერის რედაქტირება (ადმინი)
voucherRouter.put('/:id', authMiddleware, requirePermission('vouchers.create'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { code, durationMinutes, deviceCategory, expirationDate, notes, status } = req.body;

  const existing = queryOne<any>('SELECT * FROM vouchers WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ვაუჩერი ვერ მოიძებნა.' });
    return;
  }

  execute(`
    UPDATE vouchers SET code = ?, duration_minutes = ?, device_category = ?, expiration_date = ?, notes = ?, status = ?
    WHERE id = ?
  `, [
    code ? String(code).trim().toUpperCase() : existing.code,
    durationMinutes !== undefined ? Number(durationMinutes) : existing.duration_minutes,
    deviceCategory || existing.device_category,
    expirationDate !== undefined ? (expirationDate || null) : existing.expiration_date,
    notes !== undefined ? notes : existing.notes,
    status || existing.status,
    id
  ]);

  logAudit(req.user, 'UPDATE_VOUCHER', 'VOUCHER', id, existing, req.body, req.ip);
  res.json({ success: true, message: 'ვაუჩერი განახლდა.' });
});

// ვაუჩერის წაშლა (ადმინი)
voucherRouter.delete('/:id', authMiddleware, requirePermission('vouchers.delete'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM vouchers WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ვაუჩერი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM vouchers WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_VOUCHER', 'VOUCHER', id, existing, null, req.ip);
  res.json({ success: true, message: 'ვაუჩერი წაიშალა.' });
});
