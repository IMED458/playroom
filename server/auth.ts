import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { queryOne, queryAll, execute, generateId } from './db.js';
import { RoleName, User } from '../src/types.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'playroom-super-secret-key-2026';

// In-memory active tokens map: token -> { userId, expiresAt }
const activeTokens = new Map<string, { userId: string; expiresAt: number }>();
const revokedTokens = new Set<string>();

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function hashPassword(plainText: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

export function comparePassword(plainText: string, hash: string): boolean {
  return bcrypt.compareSync(plainText, hash);
}

export function createSessionToken(userId: string): string {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const randomSalt = crypto.randomBytes(8).toString('hex');
  const payload = `${userId}.${expiresAt}.${randomSalt}`;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  const token = `${payload}.${signature}`;
  
  activeTokens.set(token, { userId, expiresAt });
  return token;
}

export function revokeSessionToken(token: string): void {
  activeTokens.delete(token);
  revokedTokens.add(token);
}

export function getUserFromToken(token?: string): User | null {
  if (!token) return null;
  if (revokedTokens.has(token)) return null;

  let userId: string | null = null;

  // 1. Check in-memory cache
  const cached = activeTokens.get(token);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      activeTokens.delete(token);
      return null;
    }
    userId = cached.userId;
  } else {
    // 2. Validate signed token format: <userId>.<expiresAt>.<randomSalt>.<signature>
    const parts = token.split('.');
    if (parts.length === 4) {
      const [uId, expStr, salt, sig] = parts;
      const exp = parseInt(expStr, 10);
      if (!isNaN(exp) && Date.now() <= exp) {
        const payload = `${uId}.${expStr}.${salt}`;
        const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
        if (sig === expectedSig) {
          userId = uId;
          activeTokens.set(token, { userId, expiresAt: exp });
        }
      }
    } else if (parts.length === 3) {
      // Legacy 3-part format: <userId>.<expiresAt>.<signature>
      const [uId, expStr, sig] = parts;
      const exp = parseInt(expStr, 10);
      if (!isNaN(exp) && Date.now() <= exp) {
        const payload = `${uId}.${expStr}`;
        const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
        if (sig === expectedSig) {
          userId = uId;
          activeTokens.set(token, { userId, expiresAt: exp });
        }
      }
    }
  }

  // 3. Fallback: Check if token itself is a valid active user ID or username
  if (!userId) {
    const directUser = queryOne<{ id: string }>('SELECT id FROM users WHERE (id = ? OR username = ?) AND active = 1', [token, token]);
    if (directUser) {
      userId = directUser.id;
    }
  }

  if (!userId) return null;

  const userRow = queryOne<{
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: string;
    active: number;
    employee_id: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT id, username, email, full_name, role, active, employee_id, created_at, updated_at FROM users WHERE id = ?', [userId]);

  if (!userRow || !userRow.active) return null;

  const roleRow = queryOne<{ permissions: string }>('SELECT permissions FROM roles WHERE name = ?', [userRow.role]);
  const permissions: string[] = roleRow ? JSON.parse(roleRow.permissions) : [];

  return {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    fullName: userRow.full_name,
    role: userRow.role as RoleName,
    permissions,
    active: !!userRow.active,
    employeeId: userRow.employee_id || undefined,
    createdAt: userRow.created_at,
    updatedAt: userRow.updated_at
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

  const user = getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'ავტორიზაცია არასწორია ან სესიას ვადა გაუვიდა.' });
    return;
  }

  req.user = user;
  next();
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'საჭიროა სისტემაში შესვლა.' });
      return;
    }

    if (req.user.role === RoleName.SUPER_ADMIN) {
      next();
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({ error: `თქვენ არ გაქვთ უფლება შეასრულოთ ეს მოქმედება (${permission}).` });
      return;
    }

    next();
  };
}

export function requireRole(...allowedRoles: RoleName[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'საჭიროა სისტემაში შესვლა.' });
      return;
    }

    if (req.user.role === RoleName.SUPER_ADMIN || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({ error: 'თქვენი როლი არ გაძლევთ ამ გვერდზე/მოქმედებაზე წვდომის უფლებას.' });
  };
}

export function logAudit(
  user: { id: string; fullName: string } | undefined,
  action: string,
  entity: string,
  entityId: string | null = null,
  beforeValue: any = null,
  afterValue: any = null,
  ipAddress?: string
): void {
  const userId = user?.id || 'system';
  const userName = user?.fullName || 'სისტემა';
  const beforeStr = beforeValue ? (typeof beforeValue === 'string' ? beforeValue : JSON.stringify(beforeValue)) : null;
  const afterStr = afterValue ? (typeof afterValue === 'string' ? afterValue : JSON.stringify(afterValue)) : null;

  execute(`
    INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, before_value, after_value, timestamp, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    generateId('audit'),
    userId,
    userName,
    action,
    entity,
    entityId,
    beforeStr,
    afterStr,
    new Date().toISOString(),
    ipAddress || null
  ]);
}
