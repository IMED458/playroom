import { Router, Response } from 'express';
import { queryAll, queryOne, execute, generateId } from '../db.js';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth.js';
import { AttendanceRecord, Employee, PayrollRecord, RoleName, ShiftDefinition } from '../../src/types.js';

export const employeeRouter = Router();

// ----------------- EMPLOYEES -----------------

employeeRouter.get('/', authMiddleware, (req, res): void => {
  const rows = queryAll<any>('SELECT * FROM employees ORDER BY first_name ASC');
  const employees: Employee[] = rows.map(e => ({
    id: e.id,
    firstName: e.first_name,
    lastName: e.last_name,
    phone: e.phone,
    email: e.email,
    username: e.username,
    role: e.role as RoleName,
    hourlySalary: e.hourly_salary,
    revenuePercent: e.revenue_percent || 0,
    status: e.status,
    startDate: e.start_date,
    notes: e.notes || undefined,
    userId: e.user_id || undefined,
    createdAt: e.created_at
  }));
  res.json({ employees });
});

employeeRouter.post('/', authMiddleware, requirePermission('staff.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { firstName, lastName, phone, email, username, role, hourlySalary = 0, revenuePercent = 0, startDate, notes } = req.body;

  if (!firstName || !lastName || !phone || !email || !username) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ ყველა აუცილებელი ველი.' });
    return;
  }

  const existing = queryOne('SELECT id FROM employees WHERE username = ? OR email = ?', [username.trim(), email.trim()]);
  if (existing) {
    res.status(400).json({ error: 'თანამშრომელი ამ მომხმარებლის სახელით ან Email-ით უკვე არსებობს.' });
    return;
  }

  const id = generateId('emp');
  const now = new Date().toISOString();

  execute(`
    INSERT INTO employees (
      id, first_name, last_name, phone, email, username, role,
      hourly_salary, revenue_percent, status, start_date, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `, [
    id, firstName.trim(), lastName.trim(), phone.trim(), email.trim(), username.trim(),
    role || RoleName.OPERATOR, Number(hourlySalary) || 0, Number(revenuePercent) || 0,
    startDate || now.split('T')[0], notes || null, now
  ]);

  logAudit(req.user, 'CREATE_EMPLOYEE', 'EMPLOYEE', id, null, { firstName, lastName, hourlySalary }, req.ip);

  res.json({ success: true, message: 'თანამშრომელი წარმატებით დაემატა.', employeeId: id });
});

employeeRouter.put('/:id', authMiddleware, requirePermission('staff.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { firstName, lastName, phone, email, role, hourlySalary, revenuePercent, status, startDate, notes } = req.body;

  const existing = queryOne('SELECT * FROM employees WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'თანამშრომელი ვერ მოიძებნა.' });
    return;
  }

  const prev = existing as any;
  execute(`
    UPDATE employees SET
      first_name = ?, last_name = ?, phone = ?, email = ?, role = ?,
      hourly_salary = ?, revenue_percent = ?, status = ?, start_date = ?, notes = ?
    WHERE id = ?
  `, [
    firstName ?? prev.first_name,
    lastName ?? prev.last_name,
    phone ?? prev.phone,
    email ?? prev.email,
    role ?? prev.role,
    hourlySalary !== undefined ? Number(hourlySalary) : prev.hourly_salary,
    revenuePercent !== undefined ? Number(revenuePercent) : (prev.revenue_percent || 0),
    status || prev.status || 'ACTIVE',
    startDate ?? prev.start_date,
    notes !== undefined ? notes : prev.notes,
    id
  ]);

  logAudit(req.user, 'UPDATE_EMPLOYEE', 'EMPLOYEE', id, existing, { firstName, lastName, hourlySalary, status }, req.ip);

  res.json({ success: true, message: 'თანამშრომლის მონაცემები განახლდა.' });
});

// ----------------- SHIFTS -----------------

employeeRouter.get('/shifts', authMiddleware, (req, res): void => {
  const shifts = queryAll<ShiftDefinition>('SELECT id, name, start_time as startTime, end_time as endTime, is_overnight as isOvernight FROM shifts');
  res.json({ shifts });
});

employeeRouter.post('/shifts', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { name, startTime, endTime, isOvernight } = req.body;
  if (!name || !startTime || !endTime) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ ცვლის სახელი და საათები.' });
    return;
  }

  const id = generateId('shift');
  execute('INSERT INTO shifts (id, name, start_time, end_time, is_overnight) VALUES (?, ?, ?, ?, ?)', [
    id, name, startTime, endTime, isOvernight ? 1 : 0
  ]);

  logAudit(req.user, 'CREATE_SHIFT', 'SHIFT', id, null, { name, startTime, endTime }, req.ip);
  res.json({ success: true, shiftId: id });
});

// ----------------- ATTENDANCE (CLOCK IN / OUT) -----------------

employeeRouter.get('/attendance', authMiddleware, (req, res): void => {
  const { employeeId, startDate, endDate, shiftName } = req.query;

  let query = 'SELECT * FROM attendance WHERE 1=1';
  const params: any[] = [];

  if (employeeId) {
    query += ' AND employee_id = ?';
    params.push(employeeId);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (shiftName) {
    query += ' AND shift_name = ?';
    params.push(shiftName);
  }

  query += ' ORDER BY start_time DESC';

  const rows = queryAll<any>(query, params);
  const attendance: AttendanceRecord[] = rows.map(a => ({
    id: a.id,
    employeeId: a.employee_id,
    employeeName: a.employee_name,
    date: a.date,
    shiftName: a.shift_name || undefined,
    startTime: a.start_time,
    endTime: a.end_time || undefined,
    workedHours: a.worked_hours,
    hourlyRate: a.hourly_rate,
    earnedAmount: a.earned_amount,
    notes: a.notes || undefined,
    createdAt: a.created_at
  }));

  res.json({ attendance });
});

// Clock In (სამუშაოს დაწყება)
employeeRouter.post('/attendance/clock-in', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { employeeId, shiftName, notes } = req.body;
  const targetEmpId = employeeId || req.user?.employeeId;

  if (!targetEmpId) {
    res.status(400).json({ error: 'თანამშრომელი არ არის არჩეული.' });
    return;
  }

  const emp = queryOne<any>('SELECT * FROM employees WHERE id = ?', [targetEmpId]);
  if (!emp) {
    res.status(404).json({ error: 'თანამშრომელი ვერ მოიძებნა.' });
    return;
  }

  // Check if already clocked in today without clocking out
  const activeAtt = queryOne('SELECT id FROM attendance WHERE employee_id = ? AND end_time IS NULL', [targetEmpId]);
  if (activeAtt) {
    res.status(400).json({ error: 'თქვენ უკვე გაქვთ დაწყებული აქტიური ცვლა.' });
    return;
  }

  const now = new Date();
  const id = generateId('att');
  const dateStr = now.toISOString().split('T')[0];

  execute(`
    INSERT INTO attendance (
      id, employee_id, employee_name, date, shift_name,
      start_time, end_time, worked_hours, hourly_rate, earned_amount, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, 0, ?, ?)
  `, [
    id, emp.id, `${emp.first_name} ${emp.last_name}`, dateStr, shiftName || 'სტანდარტული ცვლა',
    now.toISOString(), emp.hourly_salary, notes || null, now.toISOString()
  ]);

  logAudit(req.user, 'CLOCK_IN', 'ATTENDANCE', id, null, { employee: `${emp.first_name} ${emp.last_name}`, time: now.toISOString() }, req.ip);

  res.json({ success: true, message: 'სამუშაო ცვლა წარმატებით დაიწყო.', attendanceId: id });
});

// Clock Out (სამუშაოს დასრულება)
employeeRouter.post('/attendance/clock-out', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { attendanceId, employeeId, notes } = req.body;

  let att: any;
  if (attendanceId) {
    att = queryOne('SELECT * FROM attendance WHERE id = ?', [attendanceId]);
  } else {
    const targetEmpId = employeeId || req.user?.employeeId;
    att = queryOne('SELECT * FROM attendance WHERE employee_id = ? AND end_time IS NULL ORDER BY start_time DESC', [targetEmpId]);
  }

  if (!att || att.end_time) {
    res.status(400).json({ error: 'აქტიური დაუსრულებელი ცვლა ვერ მოიძებნა.' });
    return;
  }

  const now = new Date();
  const startTime = new Date(att.start_time);
  const diffMs = Math.max(0, now.getTime() - startTime.getTime());
  const workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10; // 1 decimal place
  const earnedAmount = Math.round(workedHours * att.hourly_rate * 100) / 100;

  execute(`
    UPDATE attendance SET
      end_time = ?,
      worked_hours = ?,
      earned_amount = ?,
      notes = COALESCE(?, notes)
    WHERE id = ?
  `, [now.toISOString(), workedHours, earnedAmount, notes || null, att.id]);

  logAudit(req.user, 'CLOCK_OUT', 'ATTENDANCE', att.id, null, { workedHours, earnedAmount }, req.ip);

  res.json({
    success: true,
    message: 'სამუშაო ცვლა წარმატებით დასრულდა.',
    workedHours,
    earnedAmount
  });
});

// ----------------- PAYROLL -----------------

employeeRouter.get('/payroll', authMiddleware, requirePermission('payroll.view'), (req: AuthenticatedRequest, res: Response): void => {
  const { period = new Date().toISOString().substring(0, 7) } = req.query; // YYYY-MM

  // Fetch all active employees
  const employees = queryAll<any>('SELECT * FROM employees WHERE status = "ACTIVE"');

  // Fetch attendance records for this period
  const attendance = queryAll<any>(`
    SELECT employee_id, SUM(worked_hours) as total_hours, SUM(earned_amount) as total_earned
    FROM attendance
    WHERE date LIKE ? AND end_time IS NOT NULL
    GROUP BY employee_id
  `, [`${period}%`]);

  const attMap = new Map<string, { totalHours: number; totalEarned: number }>();
  attendance.forEach(a => attMap.set(a.employee_id, {
    totalHours: a.total_hours || 0,
    totalEarned: a.total_earned || 0
  }));

  // Fetch saved payroll records
  const existingPayroll = queryAll<any>('SELECT * FROM payroll WHERE period = ?', [period]);
  const payrollMap = new Map<string, any>();
  existingPayroll.forEach(p => payrollMap.set(p.employee_id, p));

  const result: PayrollRecord[] = employees.map(emp => {
    const existing = payrollMap.get(emp.id);
    const attData = attMap.get(emp.id) || { totalHours: 0, totalEarned: 0 };

    const totalWorkedHours = existing ? existing.total_worked_hours : attData.totalHours;
    const hourlyRate = existing ? existing.hourly_rate : emp.hourly_salary;
    const baseSalary = Math.round(totalWorkedHours * hourlyRate * 100) / 100;
    const bonus = existing ? existing.bonus : 0;
    const deduction = existing ? existing.deduction : 0;
    const finalSalary = Math.max(0, Math.round((baseSalary + bonus - deduction) * 100) / 100);

    return {
      id: existing ? existing.id : `pr_${emp.id}_${period}`,
      employeeId: emp.id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      period: period as string,
      totalWorkedHours,
      hourlyRate,
      baseSalary,
      bonus,
      bonusReason: existing?.bonus_reason || undefined,
      deduction,
      deductionReason: existing?.deduction_reason || undefined,
      finalSalary,
      paymentStatus: existing?.payment_status || 'PENDING',
      paidDate: existing?.paid_date || undefined,
      notes: existing?.notes || undefined,
      createdAt: existing?.created_at || new Date().toISOString(),
      updatedAt: existing?.updated_at || new Date().toISOString()
    };
  });

  res.json({ payroll: result, period });
});

// Update or Settle Payroll (Bonus, Deduction, Payment Status)
employeeRouter.post('/payroll/adjust', authMiddleware, requirePermission('payroll.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    employeeId,
    period,
    totalWorkedHours,
    hourlyRate,
    bonus = 0,
    bonusReason,
    deduction = 0,
    deductionReason,
    paymentStatus = 'PENDING',
    notes
  } = req.body;

  if (!employeeId || !period) {
    res.status(400).json({ error: 'გთხოვთ მიუთითოთ თანამშრომელი და პერიოდი.' });
    return;
  }

  const emp = queryOne<any>('SELECT * FROM employees WHERE id = ?', [employeeId]);
  if (!emp) {
    res.status(404).json({ error: 'თანამშრომელი ვერ მოიძებნა.' });
    return;
  }

  const rate = Number(hourlyRate ?? emp.hourly_salary);
  const hours = Number(totalWorkedHours || 0);
  const b = Number(bonus || 0);
  const d = Number(deduction || 0);
  const baseSalary = Math.round(hours * rate * 100) / 100;
  const finalSalary = Math.max(0, Math.round((baseSalary + b - d) * 100) / 100);
  const now = new Date().toISOString();
  const paidDate = paymentStatus === 'PAID' ? now : null;

  const existing = queryOne<any>('SELECT * FROM payroll WHERE employee_id = ? AND period = ?', [employeeId, period]);

  if (existing) {
    execute(`
      UPDATE payroll SET
        total_worked_hours = ?,
        hourly_rate = ?,
        base_salary = ?,
        bonus = ?,
        bonus_reason = ?,
        deduction = ?,
        deduction_reason = ?,
        final_salary = ?,
        payment_status = ?,
        paid_date = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      hours, rate, baseSalary, b, bonusReason || null, d, deductionReason || null,
      finalSalary, paymentStatus, paidDate, notes || null, now, existing.id
    ]);

    logAudit(req.user, 'UPDATE_PAYROLL', 'PAYROLL', existing.id, existing, { hours, baseSalary, bonus: b, deduction: d, finalSalary, paymentStatus }, req.ip);
  } else {
    const id = generateId('pr');
    execute(`
      INSERT INTO payroll (
        id, employee_id, employee_name, period, total_worked_hours,
        hourly_rate, base_salary, bonus, bonus_reason, deduction, deduction_reason,
        final_salary, payment_status, paid_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, employeeId, `${emp.first_name} ${emp.last_name}`, period, hours,
      rate, baseSalary, b, bonusReason || null, d, deductionReason || null,
      finalSalary, paymentStatus, paidDate, notes || null, now, now
    ]);

    logAudit(req.user, 'CREATE_PAYROLL', 'PAYROLL', id, null, { hours, baseSalary, bonus: b, deduction: d, finalSalary, paymentStatus }, req.ip);
  }

  res.json({ success: true, message: 'ხელფასის მონაცემები წარმატებით განახლდა.' });
});

// თანამშრომლის წაშლა (ადმინი)
employeeRouter.delete('/:id', authMiddleware, requirePermission('staff.delete'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM employees WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'თანამშრომელი ვერ მოიძებნა.' });
    return;
  }

  const { purge } = req.query;
  if (purge === 'true' || purge === '1') {
    execute('DELETE FROM attendance WHERE employee_id = ?', [id]);
    execute('DELETE FROM payroll WHERE employee_id = ?', [id]);
    execute('DELETE FROM staff_payouts WHERE employee_id = ?', [id]);
  }

  execute('DELETE FROM employees WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_EMPLOYEE', 'EMPLOYEE', id, existing, null, req.ip);
  res.json({ success: true, message: 'თანამშრომელი წაიშალა.' });
});

// ცვლის რედაქტირება / წაშლა
employeeRouter.put('/shifts/:id', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { name, startTime, endTime, isOvernight } = req.body;
  const existing = queryOne<any>('SELECT * FROM shifts WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ცვლა ვერ მოიძებნა.' });
    return;
  }
  execute('UPDATE shifts SET name = ?, start_time = ?, end_time = ?, is_overnight = ? WHERE id = ?', [
    name ?? existing.name, startTime ?? existing.start_time, endTime ?? existing.end_time,
    isOvernight !== undefined ? (isOvernight ? 1 : 0) : existing.is_overnight, id
  ]);
  logAudit(req.user, 'UPDATE_SHIFT', 'SHIFT', id, existing, req.body, req.ip);
  res.json({ success: true, message: 'ცვლა განახლდა.' });
});

employeeRouter.delete('/shifts/:id', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM shifts WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ცვლა ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM shifts WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_SHIFT', 'SHIFT', id, existing, null, req.ip);
  res.json({ success: true, message: 'ცვლა წაიშალა.' });
});

// დასწრების ჩანაწერის რედაქტირება (ადმინი)
employeeRouter.put('/attendance/:id', authMiddleware, requirePermission('staff.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { startTime, endTime, shiftName, notes, workedHours } = req.body;

  const existing = queryOne<any>('SELECT * FROM attendance WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return;
  }

  const newStart = startTime || existing.start_time;
  const newEnd = endTime !== undefined ? (endTime || null) : existing.end_time;

  let hours = Number(workedHours);
  if (isNaN(hours)) {
    hours = newEnd
      ? Math.round(((new Date(newEnd).getTime() - new Date(newStart).getTime()) / 3600000) * 10) / 10
      : 0;
  }
  const earned = Math.round(hours * (existing.hourly_rate || 0) * 100) / 100;

  execute(`
    UPDATE attendance SET
      start_time = ?, end_time = ?, shift_name = ?, worked_hours = ?, earned_amount = ?,
      date = ?, notes = ?
    WHERE id = ?
  `, [
    newStart, newEnd, shiftName ?? existing.shift_name, hours, earned,
    newStart.split('T')[0], notes !== undefined ? notes : existing.notes, id
  ]);

  logAudit(req.user, 'UPDATE_ATTENDANCE', 'ATTENDANCE', id, existing, req.body, req.ip);
  res.json({ success: true, message: 'დასწრების ჩანაწერი განახლდა.' });
});

employeeRouter.delete('/attendance/:id', authMiddleware, requirePermission('staff.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM attendance WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM attendance WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_ATTENDANCE', 'ATTENDANCE', id, existing, null, req.ip);
  res.json({ success: true, message: 'დასწრების ჩანაწერი წაიშალა.' });
});

// ხელფასის ჩანაწერის წაშლა
employeeRouter.delete('/payroll/:id', authMiddleware, requirePermission('payroll.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM payroll WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM payroll WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_PAYROLL', 'PAYROLL', id, existing, null, req.ip);
  res.json({ success: true, message: 'ხელფასის ჩანაწერი წაიშალა.' });
});

// ================= დღიური პროცენტული ანაზღაურება =================
// პერსონალი საათობრივ ხელფასს არ იღებს — დღის ბოლოს ერიცხებათ
// დღის ჯამური შემოსავლის კუთვნილი პროცენტი.

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function getSettingValue(key: string, fallback: string): string {
  const row = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? fallback;
}

/** დღის შემოსავალი, რომელზეც ითვლება პროცენტი */
function getRevenueBase(date: string): { base: number; totalRevenue: number; cash: number; mode: string } {
  const rows = queryAll<{ amount: number; payment_method: string }>(
    'SELECT amount, payment_method FROM transactions WHERE date = ?',
    [date]
  );
  let totalRevenue = 0;
  let cash = 0;
  rows.forEach(r => {
    totalRevenue += r.amount;
    if (r.payment_method === 'CASH') cash += r.amount;
  });
  const mode = getSettingValue('staffPayoutBase', 'TOTAL_REVENUE');
  return {
    base: round2(mode === 'CASH_ONLY' ? cash : totalRevenue),
    totalRevenue: round2(totalRevenue),
    cash: round2(cash),
    mode
  };
}

function mapPayout(p: any) {
  return {
    id: p.id,
    date: p.date,
    employeeId: p.employee_id,
    employeeName: p.employee_name,
    revenueBase: p.revenue_base,
    percent: p.percent,
    amount: p.amount,
    manualAdjustment: p.manual_adjustment || 0,
    status: p.status,
    paidAt: p.paid_at || undefined,
    paymentMethod: p.payment_method || undefined,
    notes: p.notes || undefined,
    createdById: p.created_by_id,
    createdByName: p.created_by_name,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  };
}

// დღის განაწილების გათვლა + უკვე შენახული ჩანაწერები
employeeRouter.get('/payouts', authMiddleware, requirePermission('payroll.view'), (req: AuthenticatedRequest, res: Response): void => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const { startDate, endDate } = req.query;

  // პერიოდის ისტორია
  if (startDate || endDate) {
    const from = (startDate as string) || date;
    const to = (endDate as string) || date;
    const rows = queryAll<any>('SELECT * FROM staff_payouts WHERE date >= ? AND date <= ? ORDER BY date DESC, employee_name ASC', [from, to]);
    res.json({ payouts: rows.map(mapPayout), period: { startDate: from, endDate: to } });
    return;
  }

  const revenue = getRevenueBase(date);
  const enabled = getSettingValue('staffPayoutEnabled', '1') === '1';
  const onlyWorked = getSettingValue('staffPayoutOnlyWorkedShifts', '1') === '1';
  const defaultPercent = parseFloat(getSettingValue('staffPayoutDefaultPercent', '5')) || 0;

  const employees = queryAll<any>(`SELECT * FROM employees WHERE status = 'ACTIVE' ORDER BY first_name ASC`);
  const worked = queryAll<{ employee_id: string; total_hours: number }>(`
    SELECT employee_id, SUM(worked_hours) as total_hours FROM attendance WHERE date = ? GROUP BY employee_id
  `, [date]);
  const workedMap = new Map<string, number>();
  worked.forEach(w => workedMap.set(w.employee_id, w.total_hours || 0));

  const saved = queryAll<any>('SELECT * FROM staff_payouts WHERE date = ?', [date]);
  const savedMap = new Map<string, any>();
  saved.forEach(p => savedMap.set(p.employee_id, p));

  const preview = employees
    .filter(e => !onlyWorked || workedMap.has(e.id) || savedMap.has(e.id))
    .map(e => {
      const existing = savedMap.get(e.id);
      const percent = existing ? existing.percent : (e.revenue_percent || defaultPercent);
      const amount = existing ? existing.amount : round2(revenue.base * (percent / 100));
      return {
        employeeId: e.id,
        employeeName: `${e.first_name} ${e.last_name}`,
        role: e.role,
        percent,
        workedHours: workedMap.get(e.id) || 0,
        amount,
        saved: !!existing,
        payoutId: existing?.id,
        status: existing?.status || 'PENDING'
      };
    });

  res.json({
    date,
    enabled,
    revenue,
    onlyWorkedShifts: onlyWorked,
    defaultPercent,
    totalPercent: round2(preview.reduce((sum, p) => sum + p.percent, 0)),
    totalAmount: round2(preview.reduce((sum, p) => sum + p.amount, 0)),
    preview,
    payouts: saved.map(mapPayout)
  });
});

// დღის განაწილების დაფიქსირება (გადაწერს იმავე დღის ჩანაწერებს)
employeeRouter.post('/payouts/generate', authMiddleware, requirePermission('payroll.edit'), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { date, entries, notes } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const revenue = getRevenueBase(targetDate);
    const now = new Date().toISOString();

    let list: { employeeId: string; percent?: number; amount?: number }[] = Array.isArray(entries) ? entries : [];

    if (list.length === 0) {
      const onlyWorked = getSettingValue('staffPayoutOnlyWorkedShifts', '1') === '1';
      const defaultPercent = parseFloat(getSettingValue('staffPayoutDefaultPercent', '5')) || 0;
      const employees = queryAll<any>(`SELECT * FROM employees WHERE status = 'ACTIVE'`);
      const worked = queryAll<{ employee_id: string }>('SELECT DISTINCT employee_id FROM attendance WHERE date = ?', [targetDate]);
      const workedSet = new Set(worked.map(w => w.employee_id));
      list = employees
        .filter(e => !onlyWorked || workedSet.has(e.id))
        .map(e => ({ employeeId: e.id, percent: e.revenue_percent || defaultPercent }));
    }

    if (list.length === 0) {
      res.status(400).json({ error: 'ამ დღისთვის ანაზღაურებადი პერსონალი ვერ მოიძებნა.' });
      return;
    }

    // არსებული გადაუხდელი ჩანაწერების გადაწერა (გადახდილები რჩება)
    execute(`DELETE FROM staff_payouts WHERE date = ? AND status = 'PENDING'`, [targetDate]);

    const created: any[] = [];
    for (const entry of list) {
      const emp = queryOne<any>('SELECT * FROM employees WHERE id = ?', [entry.employeeId]);
      if (!emp) continue;

      const alreadyPaid = queryOne<any>(`SELECT id FROM staff_payouts WHERE date = ? AND employee_id = ? AND status = 'PAID'`, [targetDate, emp.id]);
      if (alreadyPaid) continue;

      const percent = entry.percent !== undefined ? Number(entry.percent) : (emp.revenue_percent || 0);
      const amount = entry.amount !== undefined ? round2(Number(entry.amount)) : round2(revenue.base * (percent / 100));
      const id = generateId('payout');

      execute(`
        INSERT INTO staff_payouts (
          id, date, employee_id, employee_name, revenue_base, percent, amount,
          manual_adjustment, status, notes, created_by_id, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', ?, ?, ?, ?, ?)
      `, [
        id, targetDate, emp.id, `${emp.first_name} ${emp.last_name}`,
        revenue.base, percent, amount, notes || null,
        req.user!.id, req.user!.fullName, now, now
      ]);
      created.push({ id, employeeId: emp.id, percent, amount });
    }

    logAudit(req.user, 'GENERATE_STAFF_PAYOUTS', 'STAFF_PAYOUT', targetDate, null, { revenueBase: revenue.base, count: created.length }, req.ip);

    res.json({
      success: true,
      message: `დღის განაწილება დაფიქსირდა (${created.length} თანამშრომელი).`,
      date: targetDate,
      revenueBase: revenue.base,
      totalAmount: round2(created.reduce((s, c) => s + c.amount, 0)),
      created
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'განაწილების დაფიქსირება ვერ მოხერხდა.' });
  }
});

// ანაზღაურების რედაქტირება
employeeRouter.put('/payouts/:id', authMiddleware, requirePermission('payroll.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { percent, amount, notes, status } = req.body;

  const existing = queryOne<any>('SELECT * FROM staff_payouts WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return;
  }

  const newPercent = percent !== undefined ? Number(percent) : existing.percent;
  const newAmount = amount !== undefined
    ? round2(Number(amount))
    : (percent !== undefined ? round2(existing.revenue_base * (newPercent / 100)) : existing.amount);

  execute(`
    UPDATE staff_payouts SET percent = ?, amount = ?, manual_adjustment = ?, notes = ?, status = ?, updated_at = ?
    WHERE id = ?
  `, [
    newPercent, newAmount, round2(newAmount - round2(existing.revenue_base * (newPercent / 100))),
    notes !== undefined ? notes : existing.notes, status || existing.status,
    new Date().toISOString(), id
  ]);

  logAudit(req.user, 'UPDATE_STAFF_PAYOUT', 'STAFF_PAYOUT', id, existing, req.body, req.ip);
  res.json({ success: true, message: 'ანაზღაურება განახლდა.' });
});

// ანაზღაურების გაცემა
employeeRouter.post('/payouts/:id/pay', authMiddleware, requirePermission('payroll.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { paymentMethod = 'CASH' } = req.body;

  const payout = queryOne<any>('SELECT * FROM staff_payouts WHERE id = ?', [id]);
  if (!payout) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return;
  }
  if (payout.status === 'PAID') {
    res.status(400).json({ error: 'ეს ანაზღაურება უკვე გაცემულია.' });
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  execute(`UPDATE staff_payouts SET status = 'PAID', paid_at = ?, payment_method = ?, updated_at = ? WHERE id = ?`, [
    nowIso, paymentMethod, nowIso, id
  ]);

  // ანაზღაურება ცალკე აღირიცხება (შემოსავლის ტრანზაქციებს არ ერევა),
  // ხოლო დღის დახურვისას ნაღდით გაცემული თანხა სალაროდან აკლდება.

  logAudit(req.user, 'PAY_STAFF_PAYOUT', 'STAFF_PAYOUT', id, payout, { paymentMethod, amount: payout.amount }, req.ip);
  res.json({ success: true, message: `${payout.employee_name} — ${payout.amount.toFixed(2)} ₾ გაცემულია.` });
});

employeeRouter.delete('/payouts/:id', authMiddleware, requirePermission('payroll.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM staff_payouts WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM staff_payouts WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_STAFF_PAYOUT', 'STAFF_PAYOUT', id, existing, null, req.ip);
  res.json({ success: true, message: 'ანაზღაურების ჩანაწერი წაიშალა.' });
});
