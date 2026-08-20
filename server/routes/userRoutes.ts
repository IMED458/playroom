import { Router, Response } from 'express';
import { queryAll, queryOne, execute, generateId } from '../db.js';
import { AuthenticatedRequest, authMiddleware, hashPassword, logAudit, requirePermission, requireRole } from '../auth.js';
import { RoleName, User } from '../../src/types.js';

export const userRouter = Router();

// List all users
userRouter.get('/', authMiddleware, requirePermission('users.view'), (req: AuthenticatedRequest, res: Response): void => {
  const users = queryAll<any>('SELECT id, username, email, phone, password_hint, full_name, role, active, employee_id, created_at, updated_at FROM users ORDER BY created_at ASC');
  const roles = queryAll<{ name: string; permissions: string }>('SELECT name, permissions FROM roles');
  const roleMap = new Map<string, string[]>();
  roles.forEach(r => {
    try {
      roleMap.set(r.name, JSON.parse(r.permissions));
    } catch {
      roleMap.set(r.name, []);
    }
  });

  const result: any[] = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone || undefined,
    fullName: u.full_name,
    role: u.role as RoleName,
    permissions: roleMap.get(u.role) || [],
    active: !!u.active,
    employeeId: u.employee_id || undefined,
    passwordHint: u.password_hint || 'AdminPlayRoom2026!',
    createdAt: u.created_at,
    updatedAt: u.updated_at
  }));

  res.json({ users: result });
});

// Create new user
userRouter.post('/', authMiddleware, requirePermission('users.create'), (req: AuthenticatedRequest, res: Response): void => {
  const { username, email, phone, password, fullName, role, employeeId } = req.body;

  if (!username || !password || !fullName || !role) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა აუცილებელი ველი (სახელი, Username, როლი, პაროლი).' });
    return;
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanEmail = email?.trim().toLowerCase() || `${cleanUser}@playroom.ge`;

  const existing = queryOne('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [cleanUser, cleanEmail]);
  if (existing) {
    res.status(400).json({ error: 'მომხმარებელი ამ სახელით ან Email-ით უკვე არსებობს.' });
    return;
  }

  const id = generateId('usr');
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  execute(`
    INSERT INTO users (id, username, email, phone, password_hash, password_hint, full_name, role, active, employee_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `, [
    id, cleanUser, cleanEmail, phone ? phone.trim() : null,
    passwordHash, password, fullName.trim(), role,
    employeeId || null, now, now
  ]);

  logAudit(req.user, 'CREATE_USER', 'USER', id, null, { username: cleanUser, email: cleanEmail, fullName, role, phone }, req.ip);

  res.json({ success: true, message: 'მომხმარებელი წარმატებით შეიქმნა.', userId: id });
});

// Update user details or role or password
userRouter.put('/:id', authMiddleware, requirePermission('users.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { fullName, username, email, phone, role, active, employeeId, password } = req.body;

  const existing = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });
    return;
  }

  // Prevent disabling self if superadmin
  if (req.user?.id === id && active === false) {
    res.status(400).json({ error: 'საკუთარი თავის დეაქტივაცია შეუძლებელია.' });
    return;
  }

  const now = new Date().toISOString();
  let updatedHash = existing.password_hash;
  let updatedHint = existing.password_hint;

  if (password && password.trim().length >= 4) {
    updatedHash = hashPassword(password.trim());
    updatedHint = password.trim();
  }

  const cleanUser = username ? username.trim().toLowerCase() : existing.username;
  const cleanEmail = email ? email.trim().toLowerCase() : existing.email;

  // Check unique if changed
  if (cleanUser !== existing.username || cleanEmail !== existing.email) {
    const dup = queryOne('SELECT id FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND id != ?', [cleanUser, cleanEmail, id]);
    if (dup) {
      res.status(400).json({ error: 'მომხმარებლის სახელი ან Email უკვე დაკავებულია.' });
      return;
    }
  }

  execute(`
    UPDATE users SET
      full_name = ?, username = ?, email = ?, phone = ?, role = ?, active = ?,
      employee_id = ?, password_hash = ?, password_hint = ?, updated_at = ?
    WHERE id = ?
  `, [
    fullName ? fullName.trim() : existing.full_name,
    cleanUser,
    cleanEmail,
    phone !== undefined ? phone : existing.phone,
    role || existing.role,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    employeeId !== undefined ? employeeId : existing.employee_id,
    updatedHash,
    updatedHint,
    now,
    id
  ]);

  logAudit(req.user, 'UPDATE_USER', 'USER', id, existing, { fullName, username: cleanUser, email: cleanEmail, role, active, phone, passwordChanged: !!password }, req.ip);

  res.json({ success: true, message: 'მომხმარებლის მონაცემები წარმატებით განახლდა.' });
});

// Admin Reset Password for any user
userRouter.post('/:id/reset-password', authMiddleware, requirePermission('users.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 4) {
    res.status(400).json({ error: 'პაროლი უნდა შეიცავდეს მინიმუმ 4 სიმბოლოს.' });
    return;
  }

  const user = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) {
    res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });
    return;
  }

  const passwordHash = hashPassword(newPassword.trim());
  const now = new Date().toISOString();

  execute('UPDATE users SET password_hash = ?, password_hint = ?, updated_at = ? WHERE id = ?', [
    passwordHash, newPassword.trim(), now, id
  ]);

  logAudit(req.user, 'ADMIN_RESET_PASSWORD', 'USER', id, null, `პაროლი განახლდა მომხმარებლისთვის: ${user.username}`, req.ip);

  res.json({ success: true, message: `პაროლი წარმატებით შეიცვალა (${user.username}).` });
});

// Delete user (Super Admin / Admin)
userRouter.delete('/:id', authMiddleware, requirePermission('users.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;

  if (req.user?.id === id) {
    res.status(400).json({ error: 'საკუთარი ანგარიშის წაშლა შეუძლებელია.' });
    return;
  }

  const user = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) {
    res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });
    return;
  }

  // Count super admins
  if (user.role === RoleName.SUPER_ADMIN) {
    const saCount = queryOne<{ count: number }>('SELECT count(*) as count FROM users WHERE role = ?', [RoleName.SUPER_ADMIN]);
    if (saCount && saCount.count <= 1) {
      res.status(400).json({ error: 'ერთადერთი მთავარი ადმინისტრატორის წაშლა შეუძლებელია.' });
      return;
    }
  }

  execute('DELETE FROM users WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_USER', 'USER', id, user, null, req.ip);

  res.json({ success: true, message: 'მომხმარებელი წარმატებით წაიშალა.' });
});

// Get Roles & Permissions
userRouter.get('/roles', authMiddleware, (req, res): void => {
  const roles = queryAll<any>('SELECT * FROM roles');
  const result = roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: JSON.parse(r.permissions || '[]')
  }));
  res.json({ roles: result });
});

// Super Admin customize Role Permissions
userRouter.put('/roles/:id', authMiddleware, requireRole(RoleName.SUPER_ADMIN), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { permissions, description } = req.body;

  const role = queryOne<any>('SELECT * FROM roles WHERE id = ?', [id]);
  if (!role) {
    res.status(404).json({ error: 'როლი ვერ მოიძებნა.' });
    return;
  }

  execute('UPDATE roles SET permissions = ?, description = COALESCE(?, description) WHERE id = ?', [
    JSON.stringify(permissions || []), description || null, id
  ]);

  logAudit(req.user, 'UPDATE_ROLE_PERMISSIONS', 'ROLE', id, role.permissions, permissions, req.ip);

  res.json({ success: true, message: 'როლის უფლებები განახლდა.' });
});
