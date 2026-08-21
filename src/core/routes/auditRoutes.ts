import { Router, AppResponse as Response } from '../express';
import { queryAll, queryOne, execute } from '../db';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth';
import { AuditLog } from '../../types';

export const auditRouter = Router();

// Get audit logs with filters & pagination
auditRouter.get('/', authMiddleware, requirePermission('audit.view'), (req, res): void => {
  const { search, action, entity, userId, page = '1', limit = '50' } = req.query;

  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (search) {
    query += ' AND (action LIKE ? OR entity LIKE ? OR user_name LIKE ? OR before_value LIKE ? OR after_value LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  if (entity) {
    query += ' AND entity = ?';
    params.push(entity);
  }

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const countRow = queryOne<{ count: number }>(`SELECT count(*) as count FROM (${query})`, params);
  const total = countRow?.count || 0;

  query += ' ORDER BY timestamp DESC';

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.max(1, Math.min(200, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  query += ` LIMIT ${limitNum} OFFSET ${offset}`;

  const rows = queryAll<any>(query, params);
  const logs: AuditLog[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id || undefined,
    beforeValue: r.before_value || undefined,
    afterValue: r.after_value || undefined,
    timestamp: r.timestamp,
    ipAddress: r.ip_address || undefined
  }));

  res.json({
    logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

// აუდიტის ჩანაწერის წაშლა (მხოლოდ სუპერ-ადმინი / სრული უფლებით)
auditRouter.delete('/:id', authMiddleware, requirePermission('audit.view'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM audit_logs WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM audit_logs WHERE id = ?', [id]);
  res.json({ success: true, message: 'აუდიტის ჩანაწერი წაიშალა.' });
});

// ჟურნალის გასუფთავება მითითებულ თარიღამდე
auditRouter.post('/clear', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { beforeDate } = req.body;
  if (beforeDate) {
    execute('DELETE FROM audit_logs WHERE timestamp < ?', [`${beforeDate}T00:00:00.000Z`]);
  } else {
    execute('DELETE FROM audit_logs');
  }
  logAudit(req.user, 'CLEAR_AUDIT_LOG', 'AUDIT', null, null, { beforeDate: beforeDate || 'ALL' }, req.ip);
  res.json({ success: true, message: 'აუდიტის ჟურნალი გასუფთავდა.' });
});
