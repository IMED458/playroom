import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'playroom.sqlite');

let db: Database;

export interface QueryResult<T = any> {
  columns: string[];
  values: any[][];
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initSchema();
  saveDb();
  return db;
}

export const initDatabase = getDb;


export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(sql: string, params: any[] = []): { changes: number } {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDb();
  const res = db.exec("SELECT changes() AS changes");
  const changes = res.length > 0 && res[0].values.length > 0 ? (res[0].values[0][0] as number) : 1;
  return { changes };
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function initSchema(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      employee_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      notes TEXT,
      active INTEGER DEFAULT 1,
      current_session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_prices (
      category TEXT PRIMARY KEY,
      hourly_price REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_category TEXT NOT NULL,
      start_time TEXT NOT NULL,
      planned_duration_minutes INTEGER NOT NULL,
      planned_end_time TEXT NOT NULL,
      actual_end_time TEXT,
      used_minutes INTEGER NOT NULL,
      hourly_rate REAL NOT NULL,
      base_price REAL NOT NULL,
      discount_id TEXT,
      discount_name TEXT,
      discount_amount REAL DEFAULT 0,
      manual_discount_reason TEXT,
      extra_controllers_count INTEGER DEFAULT 0,
      extra_controllers_price REAL DEFAULT 0,
      voucher_code TEXT,
      voucher_minutes INTEGER DEFAULT 0,
      voucher_covered_amount REAL DEFAULT 0,
      is_fitpass INTEGER DEFAULT 0,
      fitpass_retail_value REAL DEFAULT 0,
      final_price REAL NOT NULL,
      customer_paid_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      comment TEXT,
      status TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discount_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      device_category TEXT DEFAULT 'ALL',
      min_duration_minutes INTEGER NOT NULL,
      max_duration_minutes INTEGER,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      active INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      duration_minutes INTEGER NOT NULL,
      device_category TEXT DEFAULT 'ALL',
      specific_device_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_by_id TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      used_session_id TEXT,
      used_by_id TEXT,
      used_by_name TEXT,
      used_at TEXT,
      expiration_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      hourly_salary REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      start_date TEXT NOT NULL,
      notes TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_overnight INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      date TEXT NOT NULL,
      shift_name TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      worked_hours REAL DEFAULT 0,
      hourly_rate REAL NOT NULL,
      earned_amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      period TEXT NOT NULL,
      total_worked_hours REAL NOT NULL,
      hourly_rate REAL NOT NULL,
      base_salary REAL NOT NULL,
      bonus REAL DEFAULT 0,
      bonus_reason TEXT,
      deduction REAL DEFAULT 0,
      deduction_reason TEXT,
      final_salary REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      paid_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      game TEXT NOT NULL,
      device_category TEXT NOT NULL,
      tournament_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      max_participants INTEGER NOT NULL,
      entry_fee REAL NOT NULL,
      prize_pool TEXT,
      status TEXT NOT NULL DEFAULT 'REGISTRATION_OPEN',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournament_participants (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      name TEXT NOT NULL,
      surname TEXT,
      nickname TEXT NOT NULL,
      phone TEXT NOT NULL,
      entry_fee REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_by_id TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_closures (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      expected_cash REAL NOT NULL,
      actual_cash REAL NOT NULL,
      cash_difference REAL NOT NULL,
      card_total REAL NOT NULL,
      transfer_total REAL NOT NULL,
      total_revenue REAL NOT NULL,
      fitpass_count INTEGER NOT NULL,
      voucher_count INTEGER NOT NULL,
      closed_by_id TEXT NOT NULL,
      closed_by_name TEXT NOT NULL,
      closed_at TEXT NOT NULL,
      comment TEXT,
      is_locked INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_category TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      deposit_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      created_by_id TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      before_value TEXT,
      after_value TEXT,
      timestamp TEXT NOT NULL,
      ip_address TEXT
    );
  `);

  // Staff daily payouts (პროცენტული ანაზღაურება დღის შემოსავლიდან)
  db.run(`
    CREATE TABLE IF NOT EXISTS staff_payouts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      revenue_base REAL NOT NULL,
      percent REAL NOT NULL,
      amount REAL NOT NULL,
      manual_adjustment REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      paid_at TEXT,
      payment_method TEXT,
      notes TEXT,
      created_by_id TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

  `);

  // Migrations for new optional columns
  const migrations = [
    `ALTER TABLE users ADD COLUMN phone TEXT`,
    `ALTER TABLE users ADD COLUMN password_hint TEXT`,
    `ALTER TABLE tournament_participants ADD COLUMN voucher_code TEXT`,
    `ALTER TABLE tournament_participants ADD COLUMN source TEXT DEFAULT 'STAFF'`,
    `ALTER TABLE tournament_participants ADD COLUMN email TEXT`,
    // ღია („მიმდინარე") სესიები — წინასწარ განსაზღვრული ხანგრძლივობის გარეშე
    `ALTER TABLE sessions ADD COLUMN is_open INTEGER DEFAULT 0`,
    // შეწყვეტილი სესიის აღრიცხვა (გადაუხდელი / ჩამოწერილი თანხა)
    `ALTER TABLE sessions ADD COLUMN unpaid_amount REAL DEFAULT 0`,
    `ALTER TABLE sessions ADD COLUMN terminated_reason TEXT`,
    // პერსონალის პროცენტული ანაზღაურება დღის შემოსავლიდან
    `ALTER TABLE employees ADD COLUMN revenue_percent REAL DEFAULT 0`,
    // მოწყობილობის ინდივიდუალური ტარიფი (NULL = კატეგორიის ტარიფი)
    `ALTER TABLE devices ADD COLUMN hourly_price REAL`
  ];
  for (const sql of migrations) {
    try {
      db.run(sql);
    } catch {}
  }

  // Update default seed user password_hints if empty
  try {
    db.run(`UPDATE users SET password_hint = 'AdminPlayRoom2026!' WHERE password_hint IS NULL`);
  } catch {}

  seedInitialData();
  syncRolePermissions();
  ensureDefaultSettings();
}

export const ALL_PERMISSIONS = [
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'sessions.create', 'sessions.edit', 'sessions.finish', 'sessions.cancel', 'sessions.delete',
  'prices.view', 'prices.edit',
  'discounts.create', 'discounts.apply', 'discounts.delete',
  'finance.view', 'finance.edit', 'finance.export', 'daily_close.execute',
  'payroll.view', 'payroll.edit',
  'staff.view', 'staff.edit', 'staff.delete',
  'tournament.view', 'tournament.edit', 'tournament.delete',
  'vouchers.view', 'vouchers.create', 'vouchers.delete',
  'reports.view', 'settings.edit', 'audit.view', 'devices.edit'
];

const ROLE_PERMISSIONS: Record<string, { description: string; permissions: string[] }> = {
  SUPER_ADMIN: { description: 'სრული წვდომა ყველა მოდულზე', permissions: ALL_PERMISSIONS },
  // ადმინს აქვს აბსოლუტურად ყველაფრის რედაქტირებისა და წაშლის უფლება
  ADMIN: { description: 'ადმინისტრატორი / მენეჯერი', permissions: ALL_PERMISSIONS },
  OPERATOR: {
    description: 'ოპერატორი / მოლარე',
    permissions: [
      'sessions.create', 'sessions.edit', 'sessions.finish', 'sessions.cancel',
      'discounts.apply', 'vouchers.view', 'vouchers.create',
      'tournament.view', 'staff.view', 'prices.view', 'finance.view'
    ]
  },
  FINANCE: {
    description: 'ფინანსისტი',
    permissions: [
      'finance.view', 'finance.edit', 'finance.export', 'reports.view',
      'payroll.view', 'payroll.edit', 'daily_close.execute', 'staff.view', 'prices.view'
    ]
  },
  EMPLOYEE: { description: 'თანამშრომელი', permissions: ['staff.view'] }
};

// როლების უფლებები ყოველ გაშვებაზე სინქრონდება, რომ განახლებები ძველ ბაზაზეც აისახოს
function syncRolePermissions(): void {
  for (const [name, cfg] of Object.entries(ROLE_PERMISSIONS)) {
    const existing = queryOne<{ id: string }>('SELECT id FROM roles WHERE name = ?', [name]);
    if (existing) {
      db.run('UPDATE roles SET description = ?, permissions = ? WHERE name = ?', [
        cfg.description, JSON.stringify(cfg.permissions), name
      ]);
    } else {
      db.run('INSERT INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)', [
        `role_${name.toLowerCase()}`, name, cfg.description, JSON.stringify(cfg.permissions)
      ]);
    }
  }
  saveDb();
}

const DEFAULT_SETTINGS: Record<string, string> = {
  businessName: 'Play Room Arena Tbilisi',
  currency: 'GEL',
  currencySymbol: '₾',
  timezone: 'Asia/Tbilisi',
  pcHourlyPrice: '10',
  psHourlyPrice: '15',
  wheelHourlyPrice: '20',
  extraControllerMode: 'HOURLY',
  extraControllerPrice: '3',
  minDurationMinutes: '30',
  timeIncrementMinutes: '30',
  roundingMode: 'ROUND_UP_30_MIN',
  soundEnabled: '1',
  // პერსონალის პროცენტული ანაზღაურება
  staffPayoutEnabled: '1',
  staffPayoutBase: 'TOTAL_REVENUE',
  staffPayoutDefaultPercent: '5',
  staffPayoutOnlyWorkedShifts: '1',
  // ღია („მიმდინარე") სესიის მინიმალური ასაღები დრო
  openSessionMinMinutes: '30'
};

// ახალი პარამეტრები ავტომატურად ჩნდება ძველ ბაზებშიც (არსებულებს არ ცვლის)
function ensureDefaultSettings(): void {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    const row = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [k]);
    if (!row) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [k, v]);
    }
  }
  saveDb();
}

function seedInitialData(): void {
  const userCount = queryOne<{ count: number }>('SELECT count(*) as count FROM users');
  if (userCount && userCount.count > 0) {
    return; // already seeded
  }

  console.log('Seeding initial Play Room data...');

  // Settings
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [k, v]);
  }

  // Device Prices
  const nowTs = new Date().toISOString();
  db.run(`INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)`, ['PC', 10.0, nowTs]);
  db.run(`INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)`, ['PLAYSTATION', 15.0, nowTs]);
  db.run(`INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)`, ['WHEEL', 20.0, nowTs]);

  // Initial Users (Super Admin, Operator, Finance, Employee)
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('AdminPlayRoom2026!', salt);

  const now = new Date().toISOString();

  db.run(`INSERT INTO users (id, username, email, password_hash, full_name, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
    'usr_superadmin', 'admin', 'admin@playroom.ge', passwordHash, 'მთავარი ადმინისტრატორი', 'SUPER_ADMIN', now, now
  ]);

  db.run(`INSERT INTO users (id, username, email, password_hash, full_name, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
    'usr_operator', 'operator', 'operator@playroom.ge', passwordHash, 'გიორგი ბერიძე (ოპერატორი)', 'OPERATOR', now, now
  ]);

  db.run(`INSERT INTO users (id, username, email, password_hash, full_name, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
    'usr_finance', 'finance', 'finance@playroom.ge', passwordHash, 'ნინო კაპანაძე (ფინანსისტი)', 'FINANCE', now, now
  ]);

  // Shifts
  db.run(`INSERT INTO shifts (id, name, start_time, end_time, is_overnight) VALUES (?, ?, ?, ?, ?)`, [
    'shift_morning', 'დილის ცვლა', '10:00', '18:00', 0
  ]);
  db.run(`INSERT INTO shifts (id, name, start_time, end_time, is_overnight) VALUES (?, ?, ?, ?, ?)`, [
    'shift_evening', 'საღამოს / ღამის ცვლა', '18:00', '02:00', 1
  ]);

  // Employees
  db.run(`INSERT INTO employees (id, first_name, last_name, phone, email, username, role, hourly_salary, status, start_date, notes, user_id, revenue_percent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'emp_giorgi', 'გიორგი', 'ბერიძე', '+995 599 11 22 33', 'giorgi@playroom.ge', 'operator', 'OPERATOR', 0, 'ACTIVE', '2026-01-10', 'უფროსი ოპერატორი', 'usr_operator', 7.0, now
  ]);

  db.run(`INSERT INTO employees (id, first_name, last_name, phone, email, username, role, hourly_salary, status, start_date, notes, user_id, revenue_percent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'emp_nino', 'ნინო', 'კაპანაძე', '+995 598 44 55 66', 'nino@playroom.ge', 'finance', 'FINANCE', 0, 'ACTIVE', '2026-02-01', 'ფინანსური აღრიცხვა', 'usr_finance', 5.0, now
  ]);

  db.run(`INSERT INTO employees (id, first_name, last_name, phone, email, username, role, hourly_salary, status, start_date, notes, user_id, revenue_percent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'emp_luka', 'ლუკა', 'მაისურაძე', '+995 577 88 99 00', 'luka@playroom.ge', 'luka_op', 'OPERATOR', 0, 'ACTIVE', '2026-03-15', 'საღამოს ცვლის ოპერატორი', null, 6.0, now
  ]);

  // Devices
  // 10 PCs
  for (let i = 1; i <= 10; i++) {
    db.run(`INSERT INTO devices (id, name, category, order_index, status, notes, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
      `dev_pc_${i}`, `PC #${i}`, 'PC', i, 'AVAILABLE', `RTX 4070 / 240Hz Gaming Setup #${i}`, now, now
    ]);
  }

  // 4 PlayStations
  for (let i = 1; i <= 4; i++) {
    db.run(`INSERT INTO devices (id, name, category, order_index, status, notes, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
      `dev_ps_${i}`, `PlayStation #${i}`, 'PLAYSTATION', i, 'AVAILABLE', `PS5 4K OLED Lounge Area #${i}`, now, now
    ]);
  }

  // 2 Wheels
  for (let i = 1; i <= 2; i++) {
    db.run(`INSERT INTO devices (id, name, category, order_index, status, notes, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
      `dev_wheel_${i}`, `Wheel #${i}`, 'WHEEL', i, 'AVAILABLE', `Logitech G29 / Fanatec Racing Rig #${i}`, now, now
    ]);
  }

  // Discount Rules
  db.run(`INSERT INTO discount_rules (id, name, description, device_category, min_duration_minutes, max_duration_minutes, discount_type, discount_value, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, [
    'disc_pc_3h', 'PC 3+ საათი (10%)', '3 საათი ან მეტი კომპიუტერზე თამაშისას 10% ფასდაკლება', 'PC', 180, null, 'PERCENTAGE', 10.0, now
  ]);

  db.run(`INSERT INTO discount_rules (id, name, description, device_category, min_duration_minutes, max_duration_minutes, discount_type, discount_value, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, [
    'disc_pc_5h', 'PC 5+ საათი (15%)', '5 საათი ან მეტი კომპიუტერზე 15% ფასდაკლება', 'PC', 300, null, 'PERCENTAGE', 15.0, now
  ]);

  db.run(`INSERT INTO discount_rules (id, name, description, device_category, min_duration_minutes, max_duration_minutes, discount_type, discount_value, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, [
    'disc_ps_4h', 'PlayStation 4 საათი (10 ₾)', '4 საათი PS-ზე 10 ₾ ფასდაკლება', 'PLAYSTATION', 240, null, 'FIXED', 10.0, now
  ]);

  // Vouchers
  db.run(`INSERT INTO vouchers (id, code, duration_minutes, device_category, status, created_by_id, created_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    'vouch_1', 'PR-8F4K2A', 60, 'ALL', 'ACTIVE', 'usr_superadmin', 'მთავარი ადმინისტრატორი', now
  ]);
  db.run(`INSERT INTO vouchers (id, code, duration_minutes, device_category, status, created_by_id, created_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    'vouch_2', 'TOURNAMENT-VIP-30', 30, 'ALL', 'ACTIVE', 'usr_superadmin', 'მთავარი ადმინისტრატორი', now
  ]);
  db.run(`INSERT INTO vouchers (id, code, duration_minutes, device_category, status, created_by_id, created_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    'vouch_3', 'PS-BONUS-120', 120, 'PLAYSTATION', 'ACTIVE', 'usr_superadmin', 'მთავარი ადმინისტრატორი', now
  ]);

  // Tournaments
  db.run(`INSERT INTO tournaments (id, name, description, game, device_category, tournament_date, start_time, max_participants, entry_fee, prize_pool, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'trn_fc26', 'EA FC 26 Championship', 'PlayStation 5 ყოველკვირეული ტურნირი', 'EA FC 26', 'PLAYSTATION', '2026-08-25', '16:00', 16, 25.0, '300 ₾ + VIP ვაუჩერები', 'REGISTRATION_OPEN', now
  ]);

  // შენიშვნა: სადემონსტრაციო სესიები/ტრანზაქციები არ ივსება,
  // რომ პირველივე დღის ფინანსური მაჩვენებლები რეალური იყოს.

  // Initial Audit Log
  db.run(`INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, before_value, after_value, timestamp)
    VALUES ('audit_init', 'usr_superadmin', 'მთავარი ადმინისტრატორი', 'SYSTEM_INITIALIZATION', 'SYSTEM', 'root', NULL, 'სისტემის ინიციალიზაცია წარმატებით დასრულდა', ?)`,
    [now]
  );

  saveDb();
  console.log('Database seeded successfully.');
}
