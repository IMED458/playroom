import { Router, AppResponse as Response } from '../express';
import { queryAll, queryOne, execute, generateId } from '../db';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth';
import { DailyClosure, FinancialStats, PaymentMethod, Transaction } from '../../types';

export const financeRouter = Router();

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Financial KPI Stats for Main Dashboard & Finance Dashboard
financeRouter.get('/stats', authMiddleware, (req, res): void => {
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStr = todayStr.substring(0, 7);

  // Today Revenue from Transactions (Source of Truth)
  const todayTx = queryAll<{ amount: number; payment_method: string }>(
    `SELECT amount, payment_method FROM transactions WHERE date = ?`,
    [todayStr]
  );

  let todayRevenue = 0;
  let todayCash = 0;
  let todayCard = 0;
  let todayTransfer = 0;

  todayTx.forEach(t => {
    todayRevenue += t.amount;
    if (t.payment_method === PaymentMethod.CASH) todayCash += t.amount;
    else if (t.payment_method === PaymentMethod.CARD) todayCard += t.amount;
    else if (t.payment_method === PaymentMethod.TRANSFER) todayTransfer += t.amount;
  });

  // This Month Revenue
  const monthTx = queryOne<{ total: number }>(
    `SELECT SUM(amount) as total FROM transactions WHERE date LIKE ?`,
    [`${thisMonthStr}%`]
  );
  const monthRevenue = monthTx?.total || 0;

  // Today Sessions stats
  const todaySessions = queryAll<any>(`
    SELECT * FROM sessions
    WHERE date(start_time) = ? AND status != 'CANCELLED'
  `, [todayStr]);

  let todayFitpassSessions = 0;
  let todayFitpassMinutes = 0;
  let todayFitpassNominalValue = 0;
  let todayVoucherSessions = 0;
  let todayVoucherMinutes = 0;
  let todayDiscountsTotal = 0;

  todaySessions.forEach(s => {
    if (s.is_fitpass) {
      todayFitpassSessions += 1;
      todayFitpassMinutes += (s.used_minutes || s.planned_duration_minutes || 0);
      todayFitpassNominalValue += (s.fitpass_retail_value || s.base_price || 0);
    }
    if (s.voucher_code) {
      todayVoucherSessions += 1;
      todayVoucherMinutes += (s.voucher_minutes || 0);
    }
    todayDiscountsTotal += (s.discount_amount || 0);
  });

  // Today Tournaments Revenue
  const tourneyTx = queryOne<{ total: number }>(`
    SELECT SUM(amount) as total FROM transactions WHERE date = ? AND source = 'TOURNAMENT'
  `, [todayStr]);
  const todayTournamentsRevenue = tourneyTx?.total || 0;

  // Active Sessions
  const activeSessionsCountRow = queryOne<{ count: number }>(`
    SELECT count(*) as count FROM sessions WHERE status = 'ACTIVE'
  `);
  const activeSessionsCount = activeSessionsCountCount(activeSessionsCountRow);

  // Available devices
  const devices = queryAll<{ category: string; status: string; active: number }>(`
    SELECT category, status, active FROM devices WHERE active = 1
  `);

  const availableDevicesCount = {
    PC: 0,
    PLAYSTATION: 0,
    WHEEL: 0,
    total: 0
  };

  devices.forEach(d => {
    if (d.status === 'AVAILABLE') {
      if (d.category === 'PC') availableDevicesCount.PC += 1;
      else if (d.category === 'PLAYSTATION') availableDevicesCount.PLAYSTATION += 1;
      else if (d.category === 'WHEEL') availableDevicesCount.WHEEL += 1;
      availableDevicesCount.total += 1;
    }
  });

  const stats: FinancialStats = {
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    monthRevenue: Math.round(monthRevenue * 100) / 100,
    todayCash: Math.round(todayCash * 100) / 100,
    todayCard: Math.round(todayCard * 100) / 100,
    todayTransfer: Math.round(todayTransfer * 100) / 100,
    todayFitpassSessions,
    todayFitpassHours: Math.round((todayFitpassMinutes / 60) * 10) / 10,
    todayFitpassNominalValue: Math.round(todayFitpassNominalValue * 100) / 100,
    todayVoucherSessions,
    todayVoucherMinutes,
    todayDiscountsTotal: Math.round(todayDiscountsTotal * 100) / 100,
    todayTournamentsRevenue: Math.round(todayTournamentsRevenue * 100) / 100,
    todayTotalSessions: todaySessions.length,
    activeSessionsCount,
    availableDevicesCount
  };

  res.json({ stats });
});

function activeSessionsCountCount(row: { count: number } | null): number {
  return row ? row.count : 0;
}

// "დღის ნავაჭრი" - Quick Full Day Sales Inspection Modal
financeRouter.get('/today-summary', authMiddleware, (req, res): void => {
  const todayStr = new Date().toISOString().split('T')[0];

  // All transactions today
  const transactions = queryAll<any>(`
    SELECT * FROM transactions WHERE date = ? ORDER BY created_at DESC
  `, [todayStr]);

  let totalRevenue = 0;
  let cash = 0;
  let card = 0;
  let transfer = 0;
  let tournamentRevenue = 0;

  transactions.forEach(t => {
    totalRevenue += t.amount;
    if (t.payment_method === PaymentMethod.CASH) cash += t.amount;
    else if (t.payment_method === PaymentMethod.CARD) card += t.amount;
    else if (t.payment_method === PaymentMethod.TRANSFER) transfer += t.amount;
    if (t.source === 'TOURNAMENT') tournamentRevenue += t.amount;
  });

  // Sessions today
  const sessions = queryAll<any>(`
    SELECT * FROM sessions WHERE date(start_time) = ? AND status != 'CANCELLED' ORDER BY created_at DESC
  `, [todayStr]);

  let totalDiscounts = 0;
  let fitpassCount = 0;
  let fitpassNominal = 0;
  let voucherCount = 0;

  const categoryBreakdown = {
    PC: { sessions: 0, hours: 0, revenue: 0 },
    PLAYSTATION: { sessions: 0, hours: 0, revenue: 0 },
    WHEEL: { sessions: 0, hours: 0, revenue: 0 }
  };

  sessions.forEach(s => {
    totalDiscounts += s.discount_amount;
    if (s.is_fitpass) {
      fitpassCount += 1;
      fitpassNominal += s.fitpass_retail_value || s.base_price;
    }
    if (s.voucher_code) {
      voucherCount += 1;
    }

    const cat = s.device_category as 'PC' | 'PLAYSTATION' | 'WHEEL';
    if (categoryBreakdown[cat]) {
      categoryBreakdown[cat].sessions += 1;
      const hours = (s.used_minutes || s.planned_duration_minutes || 0) / 60;
      categoryBreakdown[cat].hours += Math.round(hours * 10) / 10;
      categoryBreakdown[cat].revenue += s.customer_paid_amount;
    }
  });

  res.json({
    summary: {
      date: todayStr,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      cash: Math.round(cash * 100) / 100,
      card: Math.round(card * 100) / 100,
      transfer: Math.round(transfer * 100) / 100,
      tournamentRevenue: Math.round(tournamentRevenue * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      fitpassCount,
      fitpassNominal: Math.round(fitpassNominal * 100) / 100,
      voucherCount,
      totalSessionsCount: sessions.length,
      categoryBreakdown
    },
    transactions,
    sessions
  });
});

// Transaction History with filters and pagination
financeRouter.get('/transactions', authMiddleware, requirePermission('finance.view'), (req, res): void => {
  const { startDate, endDate, paymentMethod, source, page = '1', limit = '100' } = req.query;

  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params: any[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (paymentMethod) {
    query += ' AND payment_method = ?';
    params.push(paymentMethod);
  }
  if (source) {
    query += ' AND source = ?';
    params.push(source);
  }

  const countRow = queryOne<{ count: number }>(`SELECT count(*) as count FROM (${query})`, params);
  const total = countRow?.count || 0;

  // Calculate filtered totals
  const allFilteredRows = queryAll<any>(query, params);
  let filteredRevenue = 0;
  let filteredCash = 0;
  let filteredCard = 0;
  let filteredTransfer = 0;

  allFilteredRows.forEach(r => {
    filteredRevenue += r.amount;
    if (r.payment_method === PaymentMethod.CASH) filteredCash += r.amount;
    else if (r.payment_method === PaymentMethod.CARD) filteredCard += r.amount;
    else if (r.payment_method === PaymentMethod.TRANSFER) filteredTransfer += r.amount;
  });

  query += ' ORDER BY created_at DESC';

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.max(1, Math.min(200, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  query += ` LIMIT ${limitNum} OFFSET ${offset}`;

  const rows = queryAll<any>(query, params);
  const transactions: Transaction[] = rows.map(t => ({
    id: t.id,
    date: t.date,
    time: t.time,
    source: t.source,
    sourceId: t.source_id,
    amount: t.amount,
    paymentMethod: t.payment_method as PaymentMethod,
    createdById: t.created_by_id,
    createdByName: t.created_by_name,
    notes: t.notes || undefined,
    createdAt: t.created_at
  }));

  res.json({
    transactions,
    summary: {
      totalRevenue: Math.round(filteredRevenue * 100) / 100,
      cash: Math.round(filteredCash * 100) / 100,
      card: Math.round(filteredCard * 100) / 100,
      transfer: Math.round(filteredTransfer * 100) / 100,
      totalCount: total
    },
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

// Period Summary for dynamic Date Range Filter in Cash/Finance
financeRouter.get('/period-summary', authMiddleware, requirePermission('finance.view'), (req, res): void => {
  const { startDate, endDate } = req.query;
  const todayStr = new Date().toISOString().split('T')[0];

  const start = (startDate as string) || todayStr;
  const end = (endDate as string) || todayStr;

  const txList = queryAll<any>(`
    SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY created_at DESC
  `, [start, end]);

  let totalRevenue = 0;
  let cash = 0;
  let card = 0;
  let transfer = 0;
  let tournamentRevenue = 0;
  let manualAdjustments = 0;

  txList.forEach(t => {
    totalRevenue += t.amount;
    if (t.payment_method === PaymentMethod.CASH) cash += t.amount;
    else if (t.payment_method === PaymentMethod.CARD) card += t.amount;
    else if (t.payment_method === PaymentMethod.TRANSFER) transfer += t.amount;
    if (t.source === 'TOURNAMENT' || t.source === 'TOURNAMENT_ENTRY') tournamentRevenue += t.amount;
    if (t.source === 'MANUAL_ADJUSTMENT') manualAdjustments += t.amount;
  });

  const sessionList = queryAll<any>(`
    SELECT * FROM sessions WHERE date(start_time) >= ? AND date(start_time) <= ? AND status != 'CANCELLED'
  `, [start, end]);

  let fitpassCount = 0;
  let fitpassNominal = 0;
  let voucherCount = 0;
  let totalDiscounts = 0;

  sessionList.forEach(s => {
    totalDiscounts += (s.discount_amount || 0);
    if (s.is_fitpass) {
      fitpassCount += 1;
      fitpassNominal += (s.fitpass_retail_value || s.base_price || 0);
    }
    if (s.voucher_code) {
      voucherCount += 1;
    }
  });

  res.json({
    summary: {
      startDate: start,
      endDate: end,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      cash: Math.round(cash * 100) / 100,
      card: Math.round(card * 100) / 100,
      transfer: Math.round(transfer * 100) / 100,
      tournamentRevenue: Math.round(tournamentRevenue * 100) / 100,
      manualAdjustments: Math.round(manualAdjustments * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      fitpassCount,
      fitpassNominal: Math.round(fitpassNominal * 100) / 100,
      voucherCount,
      transactionsCount: txList.length,
      sessionsCount: sessionList.length
    }
  });
});

// Create Manual Transaction (Adjustment / Bar Sale / Income)
financeRouter.post('/transactions', authMiddleware, requirePermission('finance.view'), (req: AuthenticatedRequest, res: Response): void => {
  const { amount, paymentMethod = PaymentMethod.CASH, source = 'MANUAL_ADJUSTMENT', notes, date } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount === 0) {
    res.status(400).json({ error: 'გთხოვთ მიუთითოთ ვალიდური თანხა.' });
    return;
  }

  const id = generateId('tx');
  const now = new Date().toISOString();
  const txDate = date || now.split('T')[0];
  const txTime = new Date().toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' });

  execute(`
    INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, txDate, txTime, source, 'manual', numAmount, paymentMethod,
    req.user!.id, req.user!.fullName, notes || null, now
  ]);

  logAudit(req.user, 'CREATE_TRANSACTION', 'TRANSACTION', id, null, { amount: numAmount, paymentMethod, source, notes }, req.ip);

  res.json({ success: true, message: 'ტრანზაქცია წარმატებით დაემატა.', transactionId: id });
});

// Update / Edit Transaction (Admin only)
financeRouter.put('/transactions/:id', authMiddleware, requirePermission('finance.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { amount, paymentMethod, source, notes, date, time } = req.body;

  const existing = queryOne<any>('SELECT * FROM transactions WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ტრანზაქცია ვერ მოიძებნა.' });
    return;
  }

  const numAmount = amount !== undefined ? parseFloat(amount) : existing.amount;
  if (isNaN(numAmount)) {
    res.status(400).json({ error: 'გთხოვთ მიუთითოთ ვალიდური თანხა.' });
    return;
  }

  const updatedMethod = paymentMethod || existing.payment_method;
  const updatedSource = source || existing.source;
  const updatedNotes = notes !== undefined ? notes : existing.notes;
  const updatedDate = date || existing.date;
  const updatedTime = time || existing.time;

  execute(`
    UPDATE transactions SET
      amount = ?, payment_method = ?, source = ?, notes = ?, date = ?, time = ?
    WHERE id = ?
  `, [numAmount, updatedMethod, updatedSource, updatedNotes, updatedDate, updatedTime, id]);

  logAudit(req.user, 'UPDATE_TRANSACTION', 'TRANSACTION', id, existing, {
    amount: numAmount, paymentMethod: updatedMethod, source: updatedSource, notes: updatedNotes, date: updatedDate
  }, req.ip);

  res.json({ success: true, message: 'ტრანზაქცია წარმატებით დარედაქტირდა.' });
});

// Delete Transaction (Admin only)
financeRouter.delete('/transactions/:id', authMiddleware, requirePermission('finance.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;

  const existing = queryOne<any>('SELECT * FROM transactions WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ტრანზაქცია ვერ მოიძებნა.' });
    return;
  }

  execute('DELETE FROM transactions WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_TRANSACTION', 'TRANSACTION', id, existing, null, req.ip);

  res.json({ success: true, message: 'ტრანზაქცია წარმატებით წაიშალა.' });
});

// Day Closure (Close Day / დღის დახურვა)
financeRouter.post('/close-day', authMiddleware, requirePermission('daily_close.execute'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { date, actualCash, comment } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    if (actualCash === undefined || isNaN(Number(actualCash))) {
      res.status(400).json({ error: 'გთხოვთ მიუთითოთ სალაროში ფაქტობრივად არსებული ნაღდი თანხა (Actual Cash).' });
      return;
    }

    const actual = Number(actualCash);

    // Compute expected financial totals from transactions
    const txList = queryAll<{ amount: number; payment_method: string }>(`
      SELECT amount, payment_method FROM transactions WHERE date = ?
    `, [targetDate]);

    let expectedCash = 0;
    let cardTotal = 0;
    let transferTotal = 0;
    let totalRevenue = 0;

    txList.forEach(t => {
      totalRevenue += t.amount;
      if (t.payment_method === PaymentMethod.CASH) expectedCash += t.amount;
      else if (t.payment_method === PaymentMethod.CARD) cardTotal += t.amount;
      else if (t.payment_method === PaymentMethod.TRANSFER) transferTotal += t.amount;
    });

    // ნაღდით გაცემული პერსონალის ანაზღაურება სალაროდან აკლდება
    const payoutRow = queryOne<{ total: number }>(`
      SELECT SUM(amount) as total FROM staff_payouts
      WHERE date = ? AND status = 'PAID' AND (payment_method IS NULL OR payment_method = 'CASH')
    `, [targetDate]);
    const cashPayouts = Math.round((payoutRow?.total || 0) * 100) / 100;
    expectedCash = Math.round((expectedCash - cashPayouts) * 100) / 100;

    const cashDifference = Math.round((actual - expectedCash) * 100) / 100;

    // Count fitpass and voucher sessions
    const sessions = queryAll<any>(`
      SELECT is_fitpass, voucher_code FROM sessions WHERE date(start_time) = ? AND status != 'CANCELLED'
    `, [targetDate]);

    let fitpassCount = 0;
    let voucherCount = 0;
    sessions.forEach(s => {
      if (s.is_fitpass) fitpassCount += 1;
      if (s.voucher_code) voucherCount += 1;
    });

    const closureId = generateId('dc');
    const now = new Date().toISOString();

    execute(`
      INSERT OR REPLACE INTO daily_closures (
        id, date, expected_cash, actual_cash, cash_difference,
        card_total, transfer_total, total_revenue, fitpass_count, voucher_count,
        closed_by_id, closed_by_name, closed_at, comment, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      closureId, targetDate, Math.round(expectedCash * 100) / 100, Math.round(actual * 100) / 100,
      cashDifference, Math.round(cardTotal * 100) / 100, Math.round(transferTotal * 100) / 100,
      Math.round(totalRevenue * 100) / 100, fitpassCount, voucherCount,
      req.user!.id, req.user!.fullName, now, comment || null
    ]);

    logAudit(req.user, 'CLOSE_DAY', 'DAILY_CLOSURE', closureId, null, {
      date: targetDate, expectedCash, actualCash: actual, difference: cashDifference, totalRevenue
    }, req.ip);

    res.json({
      success: true,
      message: 'დღე წარმატებით დაიხურა და ფინანსური snapshot შენახულია.',
      closure: {
        id: closureId,
        date: targetDate,
        cashPayouts,
        expectedCash,
        actualCash: actual,
        cashDifference,
        cardTotal,
        transferTotal,
        totalRevenue,
        fitpassCount,
        voucherCount,
        closedAt: now
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'დღის დახურვა ვერ მოხერხდა.' });
  }
});

// დღის დახურვის გაუქმება / წაშლა (ადმინი)
financeRouter.delete('/daily-closures/:id', authMiddleware, requirePermission('finance.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM daily_closures WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'დახურვის ჩანაწერი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM daily_closures WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_DAILY_CLOSURE', 'DAILY_CLOSURE', id, existing, null, req.ip);
  res.json({ success: true, message: 'დღის დახურვა გაუქმდა — დღე ხელახლა დასახურია.' });
});

// დახურვის რედაქტირება (ფაქტობრივი ნაღდი / კომენტარი / ბლოკირება)
financeRouter.put('/daily-closures/:id', authMiddleware, requirePermission('finance.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { actualCash, comment, isLocked } = req.body;

  const existing = queryOne<any>('SELECT * FROM daily_closures WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'დახურვის ჩანაწერი ვერ მოიძებნა.' });
    return;
  }

  const actual = actualCash !== undefined ? Number(actualCash) : existing.actual_cash;
  const diff = Math.round((actual - existing.expected_cash) * 100) / 100;

  execute(`
    UPDATE daily_closures SET actual_cash = ?, cash_difference = ?, comment = ?, is_locked = ?
    WHERE id = ?
  `, [
    actual, diff,
    comment !== undefined ? comment : existing.comment,
    isLocked !== undefined ? (isLocked ? 1 : 0) : existing.is_locked,
    id
  ]);

  logAudit(req.user, 'UPDATE_DAILY_CLOSURE', 'DAILY_CLOSURE', id, existing, req.body, req.ip);
  res.json({ success: true, message: 'დახურვის ჩანაწერი განახლდა.' });
});

// Get Daily Closures list
financeRouter.get('/daily-closures', authMiddleware, requirePermission('finance.view'), (req, res): void => {
  const rows = queryAll<any>('SELECT * FROM daily_closures ORDER BY date DESC');
  const closures: DailyClosure[] = rows.map(r => ({
    id: r.id,
    date: r.date,
    expectedCash: r.expected_cash,
    actualCash: r.actual_cash,
    cashDifference: r.cash_difference,
    cardTotal: r.card_total,
    transferTotal: r.transfer_total,
    totalRevenue: r.total_revenue,
    fitpassCount: r.fitpass_count,
    voucherCount: r.voucher_count,
    closedById: r.closed_by_id,
    closedByName: r.closed_by_name,
    closedAt: r.closed_at,
    comment: r.comment || undefined,
    isLocked: !!r.is_locked
  }));
  res.json({ closures, dailyClosures: closures });
});

// ანალიტიკა & ანგარიშგება — მხარდაჭერილია `days` ან `startDate`/`endDate`
financeRouter.get('/reports', authMiddleware, requirePermission('reports.view'), (req, res): void => {
  try {
    const { startDate, endDate, days } = req.query;

    const toDateStr = (d: Date) => d.toISOString().split('T')[0];
    const daysNum = days ? Math.max(1, Math.min(365, parseInt(days as string, 10) || 7)) : null;

    const end = (endDate as string) || toDateStr(new Date());
    const start = (startDate as string) || (
      daysNum
        ? toDateStr(new Date(Date.now() - (daysNum - 1) * 24 * 3600 * 1000))
        : toDateStr(new Date(Date.now() - 29 * 24 * 3600 * 1000))
    );

    const transactions = queryAll<any>(
      `SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY created_at ASC`,
      [start, end]
    );

    const sessions = queryAll<any>(`
      SELECT * FROM sessions
      WHERE date(start_time) >= ? AND date(start_time) <= ? AND status != 'CANCELLED'
      ORDER BY start_time ASC
    `, [start, end]);

    // ---------- დღიური დინამიკა (უწყვეტი კალენდარი, ცარიელი დღეების ჩათვლით) ----------
    const dailyMap = new Map<string, {
      date: string; revenue: number; cash: number; card: number; transfer: number;
      tournament: number; sessionsCount: number;
    }>();

    const cursor = new Date(`${start}T00:00:00.000Z`);
    const endTs = new Date(`${end}T00:00:00.000Z`).getTime();
    while (cursor.getTime() <= endTs) {
      const key = toDateStr(cursor);
      dailyMap.set(key, { date: key, revenue: 0, cash: 0, card: 0, transfer: 0, tournament: 0, sessionsCount: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    transactions.forEach(t => {
      const cur = dailyMap.get(t.date) || { date: t.date, revenue: 0, cash: 0, card: 0, transfer: 0, tournament: 0, sessionsCount: 0 };
      cur.revenue += t.amount;
      if (t.payment_method === PaymentMethod.CASH) cur.cash += t.amount;
      else if (t.payment_method === PaymentMethod.CARD) cur.card += t.amount;
      else if (t.payment_method === PaymentMethod.TRANSFER) cur.transfer += t.amount;
      if (t.source === 'TOURNAMENT' || t.source === 'TOURNAMENT_ENTRY') cur.tournament += t.amount;
      dailyMap.set(t.date, cur);
    });

    sessions.forEach(s => {
      const key = (s.start_time || '').split('T')[0];
      const cur = dailyMap.get(key);
      if (cur) cur.sessionsCount += 1;
    });

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        label: d.date.substring(5), // MM-DD
        revenue: round2(d.revenue),
        cash: round2(d.cash),
        card: round2(d.card),
        transfer: round2(d.transfer),
        tournament: round2(d.tournament),
        sessionsCount: d.sessionsCount
      }));

    // ---------- საათობრივი განაწილება ----------
    const hourly: { hour: string; revenue: number; sessionsCount: number; minutes: number }[] = [];
    for (let i = 0; i < 24; i++) {
      hourly.push({ hour: `${i.toString().padStart(2, '0')}:00`, revenue: 0, sessionsCount: 0, minutes: 0 });
    }

    // ---------- კატეგორიები & მოწყობილობები ----------
    const categoryMap = new Map<string, { category: string; sessionsCount: number; totalMinutes: number; totalRevenue: number }>();
    const deviceMap = new Map<string, {
      deviceId: string; deviceName: string; category: string;
      sessionsCount: number; totalMinutes: number; totalRevenue: number;
      fitpassMinutes: number; voucherMinutes: number;
    }>();

    let totalDiscountsGiven = 0;
    let totalFitpassSessions = 0;
    let totalFitpassMinutes = 0;
    let totalFitpassNominalValue = 0;
    let totalVoucherSessions = 0;
    let totalVoucherMinutes = 0;
    let totalExtraControllersRevenue = 0;
    let totalUnpaidAmount = 0;
    let totalSessionMinutes = 0;

    sessions.forEach(s => {
      const minutes = s.used_minutes || s.planned_duration_minutes || 0;
      const revenue = s.customer_paid_amount || 0;
      totalSessionMinutes += minutes;

      const cat = categoryMap.get(s.device_category) || {
        category: s.device_category, sessionsCount: 0, totalMinutes: 0, totalRevenue: 0
      };
      cat.sessionsCount += 1;
      cat.totalMinutes += minutes;
      cat.totalRevenue += revenue;
      categoryMap.set(s.device_category, cat);

      const dev = deviceMap.get(s.device_id) || {
        deviceId: s.device_id, deviceName: s.device_name, category: s.device_category,
        sessionsCount: 0, totalMinutes: 0, totalRevenue: 0, fitpassMinutes: 0, voucherMinutes: 0
      };
      dev.sessionsCount += 1;
      dev.totalMinutes += minutes;
      dev.totalRevenue += revenue;

      if (s.is_fitpass) {
        dev.fitpassMinutes += minutes;
        totalFitpassSessions += 1;
        totalFitpassMinutes += minutes;
        totalFitpassNominalValue += (s.fitpass_retail_value || s.base_price || 0);
      }
      if (s.voucher_code) {
        dev.voucherMinutes += (s.voucher_minutes || 0);
        totalVoucherSessions += 1;
        totalVoucherMinutes += (s.voucher_minutes || 0);
      }
      deviceMap.set(s.device_id, dev);

      totalDiscountsGiven += (s.discount_amount || 0);
      totalExtraControllersRevenue += (s.extra_controllers_price || 0);
      totalUnpaidAmount += (s.unpaid_amount || 0);

      const hourIdx = new Date(s.start_time).getHours();
      if (hourly[hourIdx]) {
        hourly[hourIdx].revenue += revenue;
        hourly[hourIdx].sessionsCount += 1;
        hourly[hourIdx].minutes += minutes;
      }
    });

    const hourlyDistribution = hourly.map(h => ({ ...h, revenue: round2(h.revenue) }));

    const categoryBreakdown = ['PC', 'PLAYSTATION', 'WHEEL'].map(c => {
      const row = categoryMap.get(c) || { category: c, sessionsCount: 0, totalMinutes: 0, totalRevenue: 0 };
      return {
        category: c,
        label: c === 'PC' ? 'PC ზონა' : c === 'PLAYSTATION' ? 'PlayStation' : 'საჭე / Wheel',
        sessionsCount: row.sessionsCount,
        totalMinutes: row.totalMinutes,
        hours: Math.round((row.totalMinutes / 60) * 10) / 10,
        totalRevenue: round2(row.totalRevenue)
      };
    });

    const devicePerformance = Array.from(deviceMap.values())
      .map(d => ({ ...d, totalRevenue: round2(d.totalRevenue) }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // ---------- ჯამები ----------
    let totalRevenue = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalTransfer = 0;
    let totalTournamentRevenue = 0;

    transactions.forEach(t => {
      totalRevenue += t.amount;
      if (t.payment_method === PaymentMethod.CASH) totalCash += t.amount;
      else if (t.payment_method === PaymentMethod.CARD) totalCard += t.amount;
      else if (t.payment_method === PaymentMethod.TRANSFER) totalTransfer += t.amount;
      if (t.source === 'TOURNAMENT' || t.source === 'TOURNAMENT_ENTRY') totalTournamentRevenue += t.amount;
    });

    const activeDays = dailyTrend.filter(d => d.revenue > 0).length;
    const busiest = [...dailyTrend].sort((a, b) => b.revenue - a.revenue)[0];
    const peakHour = [...hourlyDistribution].sort((a, b) => b.sessionsCount - a.sessionsCount)[0];

    // პერსონალის გაცემული ანაზღაურება პერიოდში
    const payoutRow = queryOne<{ total: number }>(
      `SELECT SUM(amount) as total FROM staff_payouts WHERE date >= ? AND date <= ?`,
      [start, end]
    );
    const totalStaffPayouts = round2(payoutRow?.total || 0);

    res.json({
      period: { startDate: start, endDate: end, days: dailyTrend.length },
      summary: {
        totalRevenue: round2(totalRevenue),
        totalCash: round2(totalCash),
        totalCard: round2(totalCard),
        totalTransfer: round2(totalTransfer),
        totalTournamentRevenue: round2(totalTournamentRevenue),
        totalSessionsCount: sessions.length,
        totalSessionHours: Math.round((totalSessionMinutes / 60) * 10) / 10,
        averageSessionValue: sessions.length > 0 ? round2(totalRevenue / sessions.length) : 0,
        averageDailyRevenue: activeDays > 0 ? round2(totalRevenue / activeDays) : 0,
        totalDiscountsGiven: round2(totalDiscountsGiven),
        totalUnpaidAmount: round2(totalUnpaidAmount),
        totalStaffPayouts,
        netAfterPayouts: round2(totalRevenue - totalStaffPayouts),
        totalFitpassSessions,
        totalFitpassHours: Math.round((totalFitpassMinutes / 60) * 10) / 10,
        totalFitpassNominalValue: round2(totalFitpassNominalValue),
        totalVoucherSessions,
        totalVoucherHours: Math.round((totalVoucherMinutes / 60) * 10) / 10,
        totalExtraControllersRevenue: round2(totalExtraControllersRevenue),
        bestDay: busiest && busiest.revenue > 0 ? busiest : null,
        peakHour: peakHour && peakHour.sessionsCount > 0 ? peakHour : null
      },
      dailyTrend,
      hourlyDistribution,
      categoryBreakdown,
      devicePerformance
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'ანალიტიკის მონაცემების მიღება ვერ მოხერხდა.' });
  }
});
