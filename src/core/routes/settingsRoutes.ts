import { Router, AppResponse as Response } from '../express';
import { queryAll, queryOne, execute, generateId } from '../db';
import { AuthenticatedRequest, authMiddleware, hashPassword, logAudit, requirePermission, requireRole } from '../auth';
import { DeviceCategory, ExtraPriceMode, RoleName, SettingsState, ShiftDefinition } from '../../types';

export const settingsRouter = Router();

// Get full system settings
settingsRouter.get('/', authMiddleware, (req, res): void => {
  const rows = queryAll<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map<string, string>();
  rows.forEach(r => map.set(r.key, r.value));

  const prices = queryAll<{ category: string; hourly_price: number }>('SELECT category, hourly_price FROM device_prices');
  const priceMap = new Map<string, number>();
  prices.forEach(p => priceMap.set(p.category, p.hourly_price));

  const shifts = queryAll<any>('SELECT id, name, start_time as startTime, end_time as endTime, is_overnight as isOvernight FROM shifts');

  const settings: SettingsState = {
    businessName: map.get('businessName') || 'Play Room Arena Tbilisi',
    currency: map.get('currency') || 'GEL',
    currencySymbol: map.get('currencySymbol') || '₾',
    timezone: map.get('timezone') || 'Asia/Tbilisi',
    pcHourlyPrice: priceMap.get(DeviceCategory.PC) || 10.0,
    psHourlyPrice: priceMap.get(DeviceCategory.PLAYSTATION) || 15.0,
    wheelHourlyPrice: priceMap.get(DeviceCategory.WHEEL) || 20.0,
    extraControllerMode: (map.get('extraControllerMode') === 'FIXED' ? ExtraPriceMode.FIXED : ExtraPriceMode.HOURLY),
    extraControllerPrice: parseFloat(map.get('extraControllerPrice') || '3.0'),
    minDurationMinutes: parseInt(map.get('minDurationMinutes') || '30', 10),
    timeIncrementMinutes: parseInt(map.get('timeIncrementMinutes') || '30', 10),
    roundingMode: (map.get('roundingMode') === 'PREPAID_FIXED' ? 'PREPAID_FIXED' : 'ROUND_UP_30_MIN'),
    soundEnabled: map.get('soundEnabled') !== '0',
    staffPayoutEnabled: map.get('staffPayoutEnabled') !== '0',
    staffPayoutBase: (map.get('staffPayoutBase') === 'CASH_ONLY' ? 'CASH_ONLY' : 'TOTAL_REVENUE'),
    staffPayoutDefaultPercent: parseFloat(map.get('staffPayoutDefaultPercent') || '5'),
    staffPayoutOnlyWorkedShifts: map.get('staffPayoutOnlyWorkedShifts') !== '0',
    openSessionMinMinutes: parseInt(map.get('openSessionMinMinutes') || '30', 10),
    shifts: shifts.map(s => ({
      id: s.id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      isOvernight: !!s.isOvernight
    }))
  };

  res.json({ settings });
});

// Update settings
settingsRouter.put('/', authMiddleware, requirePermission('settings.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    businessName,
    currency,
    currencySymbol,
    timezone,
    pcHourlyPrice,
    psHourlyPrice,
    wheelHourlyPrice,
    extraControllerMode,
    extraControllerPrice,
    minDurationMinutes,
    timeIncrementMinutes,
    roundingMode,
    soundEnabled,
    staffPayoutEnabled,
    staffPayoutBase,
    staffPayoutDefaultPercent,
    staffPayoutOnlyWorkedShifts,
    openSessionMinMinutes
  } = req.body;

  const now = new Date().toISOString();

  if (businessName) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['businessName', businessName]);
  if (currency) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['currency', currency]);
  if (currencySymbol) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['currencySymbol', currencySymbol]);
  if (timezone) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['timezone', timezone]);
  if (extraControllerMode) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['extraControllerMode', extraControllerMode]);
  if (extraControllerPrice !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['extraControllerPrice', String(extraControllerPrice)]);
  if (minDurationMinutes !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['minDurationMinutes', String(minDurationMinutes)]);
  if (timeIncrementMinutes !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['timeIncrementMinutes', String(timeIncrementMinutes)]);
  if (roundingMode) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['roundingMode', roundingMode]);
  if (soundEnabled !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['soundEnabled', soundEnabled ? '1' : '0']);
  if (staffPayoutEnabled !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['staffPayoutEnabled', staffPayoutEnabled ? '1' : '0']);
  if (staffPayoutBase) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['staffPayoutBase', staffPayoutBase]);
  if (staffPayoutDefaultPercent !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['staffPayoutDefaultPercent', String(staffPayoutDefaultPercent)]);
  if (staffPayoutOnlyWorkedShifts !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['staffPayoutOnlyWorkedShifts', staffPayoutOnlyWorkedShifts ? '1' : '0']);
  if (openSessionMinMinutes !== undefined) execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['openSessionMinMinutes', String(openSessionMinMinutes)]);

  // Prices
  if (typeof pcHourlyPrice === 'number' && pcHourlyPrice >= 0) {
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [DeviceCategory.PC, pcHourlyPrice, now]);
  }
  if (typeof psHourlyPrice === 'number' && psHourlyPrice >= 0) {
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [DeviceCategory.PLAYSTATION, psHourlyPrice, now]);
  }
  if (typeof wheelHourlyPrice === 'number' && wheelHourlyPrice >= 0) {
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [DeviceCategory.WHEEL, wheelHourlyPrice, now]);
  }

  logAudit(req.user, 'UPDATE_SETTINGS', 'SETTINGS', 'SYSTEM', null, req.body, req.ip);

  res.json({ success: true, message: 'პარამეტრები წარმატებით შეინახა.' });
});

// Setup Wizard (First-Run / Business Initialization)
settingsRouter.post('/wizard', authMiddleware, requireRole(RoleName.SUPER_ADMIN), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const {
      businessName = 'Play Room Arena',
      pcCount = 10,
      pcPrice = 10,
      psCount = 4,
      psPrice = 15,
      wheelCount = 2,
      wheelPrice = 20,
      extraControllerPrice = 3,
      extraControllerMode = 'HOURLY',
      morningShiftStart = '10:00',
      morningShiftEnd = '18:00',
      eveningShiftStart = '18:00',
      eveningShiftEnd = '02:00'
    } = req.body;

    const now = new Date().toISOString();

    // 1. Settings
    execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['businessName', businessName]);
    execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['extraControllerPrice', String(extraControllerPrice)]);
    execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['extraControllerMode', extraControllerMode]);

    // 2. Prices
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [DeviceCategory.PC, Number(pcPrice), now]);
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [DeviceCategory.PLAYSTATION, Number(psPrice), now]);
    execute('INSERT OR REPLACE INTO device_prices (category, hourly_price, updated_at) VALUES (?, ?, ?)', [DeviceCategory.WHEEL, Number(wheelPrice), now]);

    // 3. Clear non-active devices and re-create based on wizard counts
    execute('DELETE FROM devices WHERE current_session_id IS NULL');

    // Create PCs
    for (let i = 1; i <= Number(pcCount); i++) {
      const id = generateId('dev_pc');
      execute('INSERT INTO devices (id, name, category, order_index, status, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, "AVAILABLE", ?, 1, ?, ?)', [
        id, `PC #${i}`, DeviceCategory.PC, i, `Gaming PC Setup #${i}`, now, now
      ]);
    }

    // Create PlayStations
    for (let i = 1; i <= Number(psCount); i++) {
      const id = generateId('dev_ps');
      execute('INSERT INTO devices (id, name, category, order_index, status, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, "AVAILABLE", ?, 1, ?, ?)', [
        id, `PlayStation #${i}`, DeviceCategory.PLAYSTATION, i, `PS5 Lounge Setup #${i}`, now, now
      ]);
    }

    // Create Wheels
    for (let i = 1; i <= Number(wheelCount); i++) {
      const id = generateId('dev_wheel');
      execute('INSERT INTO devices (id, name, category, order_index, status, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, "AVAILABLE", ?, 1, ?, ?)', [
        id, `Wheel #${i}`, DeviceCategory.WHEEL, i, `Racing Simulator Rig #${i}`, now, now
      ]);
    }

    // 4. Shifts
    execute('DELETE FROM shifts');
    execute('INSERT INTO shifts (id, name, start_time, end_time, is_overnight) VALUES (?, ?, ?, ?, 0)', [
      generateId('shift'), 'დილის ცვლა', morningShiftStart, morningShiftEnd
    ]);
    execute('INSERT INTO shifts (id, name, start_time, end_time, is_overnight) VALUES (?, ?, ?, ?, 1)', [
      generateId('shift'), 'საღამოს / ღამის ცვლა', eveningShiftStart, eveningShiftEnd
    ]);

    logAudit(req.user, 'RUN_SETUP_WIZARD', 'SETUP_WIZARD', 'SYSTEM', null, req.body, req.ip);

    res.json({
      success: true,
      message: 'Setup Wizard წარმატებით შესრულდა. მოწყობილობები და ტარიფები განახლდა.'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Setup Wizard ვერ შესრულდა.' });
  }
});
