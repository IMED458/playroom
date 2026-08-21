import { AppRequest, createResponse, Router } from './express';
import { initDatabase } from './db';
import { authRouter } from './routes/authRoutes';
import { deviceRouter } from './routes/deviceRoutes';
import { sessionRouter } from './routes/sessionRoutes';
import { discountRouter } from './routes/discountRoutes';
import { voucherRouter } from './routes/voucherRoutes';
import { employeeRouter } from './routes/employeeRoutes';
import { tournamentRouter } from './routes/tournamentRoutes';
import { financeRouter } from './routes/financeRoutes';
import { settingsRouter } from './routes/settingsRoutes';
import { auditRouter } from './routes/auditRoutes';
import { userRouter } from './routes/userRoutes';
import { reservationRouter } from './routes/reservationRoutes';

/** მოდულების რუკა — /api/<prefix>/... */
const ROUTERS: { prefix: string; router: Router }[] = [
  { prefix: 'auth', router: authRouter },
  { prefix: 'devices', router: deviceRouter },
  { prefix: 'sessions', router: sessionRouter },
  { prefix: 'discounts', router: discountRouter },
  { prefix: 'vouchers', router: voucherRouter },
  { prefix: 'employees', router: employeeRouter },
  { prefix: 'tournaments', router: tournamentRouter },
  { prefix: 'finance', router: financeRouter },
  { prefix: 'settings', router: settingsRouter },
  { prefix: 'audit', router: auditRouter },
  { prefix: 'users', router: userRouter },
  { prefix: 'reservations', router: reservationRouter }
];

let readyPromise: Promise<unknown> | null = null;

/** ბაზა ერთხელ ინიციალიზდება პირველივე მოთხოვნაზე */
export function ensureReady(): Promise<unknown> {
  if (!readyPromise) {
    readyPromise = initDatabase();
  }
  return readyPromise;
}

export interface LocalResult {
  status: number;
  data: any;
}

/**
 * მოთხოვნის დამუშავება ბრაუზერშივე — fetch-ის ნაცვლად.
 * endpoint: "/sessions/xyz/finish?limit=5"
 */
export async function handleRequest(
  method: string,
  endpoint: string,
  body?: any,
  token?: string | null
): Promise<LocalResult> {
  await ensureReady();

  const [rawPath, rawQuery] = endpoint.split('?');
  const query: Record<string, string> = {};
  if (rawQuery) {
    new URLSearchParams(rawQuery).forEach((value, key) => {
      query[key] = value;
    });
  }

  const segments = rawPath.split('/').filter(Boolean);
  const prefix = segments[0];
  const entry = ROUTERS.find(r => r.prefix === prefix);

  if (!entry) {
    return { status: 404, data: { error: `მოთხოვნილი მისამართი ვერ მოიძებნა: /${rawPath}` } };
  }

  const req: AppRequest = {
    method: method.toUpperCase(),
    path: '/' + segments.slice(1).join('/'),
    params: {},
    query,
    body: body ?? {},
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ip: 'local'
  };

  const res = createResponse();

  await new Promise<void>(resolve => {
    entry.router(req, res, () => {
      if (!res.finished) {
        res.status(404).json({ error: `მოთხოვნილი მისამართი ვერ მოიძებნა: /${rawPath}` });
      }
      resolve();
    });
    resolve();
  });

  if (!res.finished) {
    return { status: 404, data: { error: `მოთხოვნილი მისამართი ვერ მოიძებნა: /${rawPath}` } };
  }

  return { status: res.statusCode, data: res.body };
}
