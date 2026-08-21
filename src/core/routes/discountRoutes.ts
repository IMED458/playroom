import { Router, AppResponse as Response } from '../express';
import { queryAll, queryOne, execute, generateId } from '../db';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth';
import { DiscountRule, DiscountType } from '../../types';

export const discountRouter = Router();

// Get all discount rules
discountRouter.get('/', authMiddleware, (req, res): void => {
  const rules = queryAll<any>('SELECT * FROM discount_rules ORDER BY created_at DESC');
  const result: DiscountRule[] = rules.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description || undefined,
    deviceCategory: r.device_category,
    minDurationMinutes: r.min_duration_minutes,
    maxDurationMinutes: r.max_duration_minutes || undefined,
    discountType: r.discount_type as DiscountType,
    discountValue: r.discount_value,
    active: !!r.active,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    createdAt: r.created_at
  }));
  res.json({ discounts: result });
});

// Create discount rule
discountRouter.post('/', authMiddleware, requirePermission('discounts.create'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    name,
    description,
    deviceCategory = 'ALL',
    minDurationMinutes,
    maxDurationMinutes,
    discountType,
    discountValue,
    startDate,
    endDate
  } = req.body;

  if (!name || !minDurationMinutes || !discountType || discountValue === undefined) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა აუცილებელი ველი.' });
    return;
  }

  const id = generateId('disc');
  const now = new Date().toISOString();

  execute(`
    INSERT INTO discount_rules (
      id, name, description, device_category, min_duration_minutes, max_duration_minutes,
      discount_type, discount_value, active, start_date, end_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `, [
    id, name.trim(), description || null, deviceCategory, Number(minDurationMinutes),
    maxDurationMinutes ? Number(maxDurationMinutes) : null, discountType, Number(discountValue),
    startDate || null, endDate || null, now
  ]);

  logAudit(req.user, 'CREATE_DISCOUNT_RULE', 'DISCOUNT_RULE', id, null, { name, discountType, discountValue, deviceCategory, minDurationMinutes }, req.ip);

  res.json({ success: true, message: 'ფასდაკლების წესი წარმატებით შეიქმნა.', discountId: id });
});

// Update discount rule
discountRouter.put('/:id', authMiddleware, requirePermission('discounts.create'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const {
    name,
    description,
    deviceCategory,
    minDurationMinutes,
    maxDurationMinutes,
    discountType,
    discountValue,
    active,
    startDate,
    endDate
  } = req.body;

  const existing = queryOne('SELECT * FROM discount_rules WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ფასდაკლების წესი ვერ მოიძებნა.' });
    return;
  }

  execute(`
    UPDATE discount_rules SET
      name = ?, description = ?, device_category = ?, min_duration_minutes = ?,
      max_duration_minutes = ?, discount_type = ?, discount_value = ?,
      active = ?, start_date = ?, end_date = ?
    WHERE id = ?
  `, [
    name, description || null, deviceCategory, Number(minDurationMinutes),
    maxDurationMinutes ? Number(maxDurationMinutes) : null, discountType, Number(discountValue),
    active ? 1 : 0, startDate || null, endDate || null, id
  ]);

  logAudit(req.user, 'UPDATE_DISCOUNT_RULE', 'DISCOUNT_RULE', id, existing, { name, discountType, discountValue }, req.ip);

  res.json({ success: true, message: 'ფასდაკლების წესი განახლდა.' });
});

// Toggle Active
discountRouter.post('/:id/toggle-active', authMiddleware, requirePermission('discounts.create'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const rule = queryOne<{ active: number }>('SELECT active FROM discount_rules WHERE id = ?', [id]);
  if (!rule) {
    res.status(404).json({ error: 'ფასდაკლების წესი ვერ მოიძებნა.' });
    return;
  }

  const newActive = rule.active ? 0 : 1;
  execute('UPDATE discount_rules SET active = ? WHERE id = ?', [newActive, id]);

  logAudit(req.user, 'TOGGLE_DISCOUNT_ACTIVE', 'DISCOUNT_RULE', id, rule.active, newActive, req.ip);

  res.json({ success: true, active: !!newActive });
});

// ფასდაკლების წესის წაშლა (ადმინი)
discountRouter.delete('/:id', authMiddleware, requirePermission('discounts.delete'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM discount_rules WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ფასდაკლების წესი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM discount_rules WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_DISCOUNT_RULE', 'DISCOUNT_RULE', id, existing, null, req.ip);
  res.json({ success: true, message: 'ფასდაკლების წესი წაიშალა.' });
});
