import express from 'express';
import path from 'path';
import { initDatabase } from './server/db.js';
import { authRouter } from './server/routes/authRoutes.js';
import { deviceRouter } from './server/routes/deviceRoutes.js';
import { sessionRouter } from './server/routes/sessionRoutes.js';
import { discountRouter } from './server/routes/discountRoutes.js';
import { voucherRouter } from './server/routes/voucherRoutes.js';
import { employeeRouter } from './server/routes/employeeRoutes.js';
import { tournamentRouter } from './server/routes/tournamentRoutes.js';
import { financeRouter } from './server/routes/financeRoutes.js';
import { settingsRouter } from './server/routes/settingsRoutes.js';
import { auditRouter } from './server/routes/auditRoutes.js';
import { userRouter } from './server/routes/userRoutes.js';
import { reservationRouter } from './server/routes/reservationRoutes.js';

async function startServer() {
  // 1. Initialize SQLite Database & Initial Seed
  await initDatabase();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/devices', deviceRouter);
  app.use('/api/sessions', sessionRouter);
  app.use('/api/discounts', discountRouter);
  app.use('/api/vouchers', voucherRouter);
  app.use('/api/employees', employeeRouter);
  app.use('/api/tournaments', tournamentRouter);
  app.use('/api/finance', financeRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/users', userRouter);
  app.use('/api/reservations', reservationRouter);

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Play Room Management System running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
