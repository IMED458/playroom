import { Router, Response } from 'express';
import { queryAll, queryOne, execute, generateId } from '../db.js';
import { AuthenticatedRequest, authMiddleware, logAudit, requirePermission } from '../auth.js';
import { DeviceCategory, PaymentMethod, PaymentStatus, Tournament, TournamentParticipant, TournamentStatus } from '../../src/types.js';

export const tournamentRouter = Router();

// Get all tournaments with computed participant counts and revenues
tournamentRouter.get('/', authMiddleware, (req, res): void => {
  const rows = queryAll<any>('SELECT * FROM tournaments ORDER BY tournament_date DESC, start_time DESC');
  const participants = queryAll<any>('SELECT * FROM tournament_participants');

  const partMap = new Map<string, { total: number; paid: number; collected: number; online: number }>();
  participants.forEach(p => {
    const cur = partMap.get(p.tournament_id) || { total: 0, paid: 0, collected: 0, online: 0 };
    cur.total += 1;
    if (p.payment_status === 'PAID') {
      cur.paid += 1;
      cur.collected += p.entry_fee;
    }
    if (p.source === 'PUBLIC_LINK') cur.online += 1;
    partMap.set(p.tournament_id, cur);
  });

  const tournaments: Tournament[] = rows.map(t => {
    const pStats = partMap.get(t.id) || { total: 0, paid: 0, collected: 0, online: 0 };
    const prizePoolStr = t.prize_pool ? (typeof t.prize_pool === 'number' ? `${t.prize_pool} ₾` : String(t.prize_pool)) : `${t.entry_fee * t.max_participants} ₾`;
    return {
      id: t.id,
      name: t.name,
      description: t.description || undefined,
      game: t.game,
      gameName: t.game,
      date: t.tournament_date,
      deviceCategory: t.device_category as DeviceCategory,
      tournamentDate: t.tournament_date,
      startTime: t.start_time || '12:00',
      maxParticipants: t.max_participants,
      entryFee: t.entry_fee,
      prizePool: prizePoolStr,
      status: t.status as TournamentStatus,
      notes: t.notes || undefined,
      participantsCount: pStats.total,
      paidParticipantsCount: pStats.paid,
      onlineRegistrationsCount: pStats.online,
      totalCollected: Math.round(pStats.collected * 100) / 100,
      expectedRevenue: Math.round(t.entry_fee * t.max_participants * 100) / 100,
      createdAt: t.created_at
    } as any;
  });

  res.json({ tournaments });
});

// PUBLIC: Get public tournament info for shareable link (No auth required)
tournamentRouter.get('/public/:id', (req, res): void => {
  const { id } = req.params;
  const t = queryOne<any>('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (!t) {
    res.status(404).json({ error: 'ტურნირი ვერ მოიძებნა ან წაშლილია.' });
    return;
  }

  const partCountRow = queryOne<{ count: number }>('SELECT count(*) as count FROM tournament_participants WHERE tournament_id = ?', [id]);
  const participantsCount = partCountRow?.count || 0;
  const prizePoolStr = t.prize_pool ? (typeof t.prize_pool === 'number' ? `${t.prize_pool} ₾` : String(t.prize_pool)) : `${t.entry_fee * t.max_participants} ₾`;

  res.json({
    tournament: {
      id: t.id,
      name: t.name,
      description: t.description || '',
      game: t.game,
      gameName: t.game,
      deviceCategory: t.device_category,
      tournamentDate: t.tournament_date,
      date: t.tournament_date,
      startTime: t.start_time || '12:00',
      maxParticipants: t.max_participants,
      entryFee: t.entry_fee,
      prizePool: prizePoolStr,
      status: t.status,
      notes: t.notes || '',
      participantsCount,
      slotsLeft: Math.max(0, t.max_participants - participantsCount),
      isFull: participantsCount >= t.max_participants,
      registrationOpen: t.status === 'REGISTRATION_OPEN' && participantsCount < t.max_participants
    }
  });
});

// PUBLIC: Register participant from shareable tournament link (No auth required)
tournamentRouter.post('/public/:id/register', (req, res): void => {
  const { id } = req.params;
  const {
    name,
    fullName,
    surname,
    nickname,
    phone,
    voucherCode,
    notes
  } = req.body;

  const actualName = (fullName || name || nickname || '').trim();
  const actualNick = (nickname || fullName || name || '').trim();
  const cleanPhone = (phone || '').trim();

  if (!actualName || !actualNick || !cleanPhone) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ სახელი, ნიკნეიმი და ტელეფონის ნომერი.' });
    return;
  }

  const tournament = queryOne<any>('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (!tournament) {
    res.status(404).json({ error: 'ტურნირი ვერ მოიძებნა.' });
    return;
  }

  if (tournament.status !== 'REGISTRATION_OPEN') {
    res.status(400).json({ error: 'ამ ტურნირზე რეგისტრაცია ამჟამად დახურულია.' });
    return;
  }

  const currentCount = queryOne<{ count: number }>('SELECT count(*) as count FROM tournament_participants WHERE tournament_id = ?', [id]);
  if (currentCount && currentCount.count >= tournament.max_participants) {
    res.status(400).json({ error: 'სამწუხაროდ, ტურნირზე ადგილები უკვე შევსებულია.' });
    return;
  }

  // Check if player already registered with this phone or nickname
  const dupCheck = queryOne('SELECT id FROM tournament_participants WHERE tournament_id = ? AND (phone = ? OR LOWER(nickname) = ?)', [
    id, cleanPhone, actualNick.toLowerCase()
  ]);
  if (dupCheck) {
    res.status(400).json({ error: 'მონაწილე ამ ტელეფონის ნომრით ან ნიკნეიმით უკვე დარეგისტრირებულია.' });
    return;
  }

  let finalFee = tournament.entry_fee;
  let paymentStatus = PaymentStatus.PENDING;
  let paymentMethod = PaymentMethod.CASH;
  let voucherApplied = false;

  // Handle Voucher Check & Registration
  if (voucherCode && voucherCode.trim().length > 0) {
    const cleanVoucher = voucherCode.trim().toUpperCase();
    const v = queryOne<any>('SELECT * FROM vouchers WHERE code = ?', [cleanVoucher]);
    if (v && v.status === 'ACTIVE' && (!v.expiration_date || new Date(v.expiration_date) >= new Date())) {
      voucherApplied = true;
      finalFee = 0; // Voucher covers tournament entry
      paymentStatus = PaymentStatus.PAID;
      paymentMethod = PaymentMethod.VOUCHER;

      // Mark voucher used
      execute(`UPDATE vouchers SET status = 'USED', used_at = ?, notes = COALESCE(notes, '') || ' [Used for tournament ${tournament.name}]' WHERE id = ?`, [
        new Date().toISOString(), v.id
      ]);
    }
  }

  const partId = generateId('tp');
  const now = new Date().toISOString();

  execute(`
    INSERT INTO tournament_participants (
      id, tournament_id, name, surname, nickname, phone, email, entry_fee, payment_method,
      payment_status, voucher_code, source, registered_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLIC_LINK', ?, ?)
  `, [
    partId, id, actualName, surname || null, actualNick, cleanPhone, (req.body.email || '').trim() || null,
    finalFee, paymentMethod, paymentStatus, voucherCode ? voucherCode.trim().toUpperCase() : null,
    now, notes || null
  ]);

  res.json({
    success: true,
    message: 'რეგისტრაცია წარმატებით დასრულდა!',
    participantId: partId,
    tournamentName: tournament.name,
    game: tournament.game,
    date: tournament.tournament_date,
    startTime: tournament.start_time,
    entryFee: finalFee,
    paymentStatus,
    voucherApplied
  });
});

// Get single tournament with participants
tournamentRouter.get('/:id', authMiddleware, (req, res): void => {
  const { id } = req.params;
  const t = queryOne<any>('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (!t) {
    res.status(404).json({ error: 'ტურნირი ვერ მოიძებნა.' });
    return;
  }

  const participants = queryAll<any>('SELECT * FROM tournament_participants WHERE tournament_id = ? ORDER BY registered_at ASC', [id]);
  const prizePoolStr = t.prize_pool ? (typeof t.prize_pool === 'number' ? `${t.prize_pool} ₾` : String(t.prize_pool)) : `${t.entry_fee * t.max_participants} ₾`;

  const tourneyObj = {
    id: t.id,
    name: t.name,
    description: t.description || undefined,
    game: t.game,
    gameName: t.game,
    deviceCategory: t.device_category as DeviceCategory,
    date: t.tournament_date,
    tournamentDate: t.tournament_date,
    startTime: t.start_time || '12:00',
    maxParticipants: t.max_participants,
    entryFee: t.entry_fee,
    prizePool: prizePoolStr,
    status: t.status as TournamentStatus,
    notes: t.notes || undefined,
    createdAt: t.created_at
  };

  const partList = participants.map(p => ({
    id: p.id,
    tournament_id: p.tournament_id,
    tournamentId: p.tournament_id,
    participant_name: p.name || p.nickname,
    name: p.name || p.nickname,
    surname: p.surname || undefined,
    nickname: p.nickname || p.name,
    phone: p.phone || '',
    entry_fee: p.entry_fee,
    entryFee: p.entry_fee,
    is_paid: p.payment_status === 'PAID',
    payment_method: p.payment_method as PaymentMethod,
    paymentMethod: p.payment_method as PaymentMethod,
    payment_status: p.payment_status as PaymentStatus,
    paymentStatus: p.payment_status as PaymentStatus,
    email: p.email || undefined,
    source: p.source || 'STAFF',
    isPublicRegistration: p.source === 'PUBLIC_LINK',
    registered_at: p.registered_at,
    registeredAt: p.registered_at,
    created_at: p.registered_at,
    notes: p.notes || undefined
  }));

  res.json({
    tournament: tourneyObj,
    participants: partList
  });
});

// Create Tournament
tournamentRouter.post('/', authMiddleware, requirePermission('tournament.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    name,
    description,
    game,
    gameName,
    deviceCategory = DeviceCategory.PLAYSTATION,
    tournamentDate,
    date,
    startTime = '12:00',
    maxParticipants = 16,
    entryFee = 0,
    prizePool,
    status = TournamentStatus.REGISTRATION_OPEN,
    notes
  } = req.body;

  const actualName = name?.trim();
  const actualGame = (game || gameName)?.trim();
  const actualDate = tournamentDate || date;

  if (!actualName || !actualGame || !actualDate) {
    res.status(400).json({ error: 'გთხოვთ შეავსოთ ტურნირის ყველა სავალდებულო ველი.' });
    return;
  }

  const id = generateId('trn');
  const now = new Date().toISOString();

  execute(`
    INSERT INTO tournaments (
      id, name, description, game, device_category, tournament_date,
      start_time, max_participants, entry_fee, prize_pool, status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, actualName, description || null, actualGame, deviceCategory, actualDate,
    startTime || '12:00', Number(maxParticipants), Number(entryFee), prizePool ? String(prizePool) : null, status, notes || null, now
  ]);

  logAudit(req.user, 'CREATE_TOURNAMENT', 'TOURNAMENT', id, null, { name: actualName, game: actualGame, entryFee, maxParticipants }, req.ip);

  res.json({ success: true, message: 'ტურნირი წარმატებით შეიქმნა.', tournamentId: id });
});

// Update Tournament
tournamentRouter.put('/:id', authMiddleware, requirePermission('tournament.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const { name, description, game, deviceCategory, tournamentDate, startTime, maxParticipants, entryFee, prizePool, status, notes } = req.body;

  const existing = queryOne('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ტურნირი ვერ მოიძებნა.' });
    return;
  }

  execute(`
    UPDATE tournaments SET
      name = ?, description = ?, game = ?, device_category = ?,
      tournament_date = ?, start_time = ?, max_participants = ?,
      entry_fee = ?, prize_pool = ?, status = ?, notes = ?
    WHERE id = ?
  `, [
    name, description || null, game, deviceCategory,
    tournamentDate, startTime, Number(maxParticipants),
    Number(entryFee), prizePool || null, status, notes || null, id
  ]);

  logAudit(req.user, 'UPDATE_TOURNAMENT', 'TOURNAMENT', id, existing, { name, status, entryFee }, req.ip);

  res.json({ success: true, message: 'ტურნირის მონაცემები განახლდა.' });
});

// Get participants of tournament
tournamentRouter.get('/:id/participants', authMiddleware, (req, res): void => {
  const { id } = req.params;
  const participants = queryAll<any>('SELECT * FROM tournament_participants WHERE tournament_id = ? ORDER BY registered_at ASC', [id]);

  const result: TournamentParticipant[] = participants.map(p => ({
    id: p.id,
    tournamentId: p.tournament_id,
    name: p.name,
    surname: p.surname || undefined,
    nickname: p.nickname,
    phone: p.phone,
    entryFee: p.entry_fee,
    paymentMethod: p.payment_method as PaymentMethod,
    paymentStatus: p.payment_status as PaymentStatus,
    email: p.email || undefined,
    source: p.source || 'STAFF',
    isPublicRegistration: p.source === 'PUBLIC_LINK',
    voucherCode: p.voucher_code || undefined,
    registeredAt: p.registered_at,
    notes: p.notes || undefined
  } as any));

  res.json({ participants: result });
});

// Add participant to tournament
const handleAddParticipant = (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const {
    name,
    participantName,
    surname,
    nickname,
    phone = '',
    entryFee,
    paymentMethod = PaymentMethod.CASH,
    paymentStatus,
    isPaid,
    notes
  } = req.body;

  const actualName = (participantName || name || nickname || 'მოთამაშე').trim();
  const actualNick = (nickname || participantName || name || 'მოთამაშე').trim();
  const actualPaid = isPaid !== undefined ? (isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING) : (paymentStatus || PaymentStatus.PAID);

  const tournament = queryOne<any>('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (!tournament) {
    res.status(404).json({ error: 'ტურნირი ვერ მოიძებნა.' });
    return;
  }

  const currentCount = queryOne<{ count: number }>('SELECT count(*) as count FROM tournament_participants WHERE tournament_id = ?', [id]);
  if (currentCount && currentCount.count >= tournament.max_participants) {
    res.status(400).json({ error: 'ტურნირზე ადგილები შევსებულია.' });
    return;
  }

  const partId = generateId('tp');
  const now = new Date().toISOString();
  const fee = Number(entryFee ?? tournament.entry_fee);

  execute(`
    INSERT INTO tournament_participants (
      id, tournament_id, name, surname, nickname, phone, entry_fee, payment_method, payment_status, registered_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    partId, id, actualName, surname || null, actualNick, phone.trim(),
    fee, paymentMethod, actualPaid, now, notes || null
  ]);

  // If paid, create transaction
  if (actualPaid === PaymentStatus.PAID && fee > 0) {
    const txId = generateId('tx');
    execute(`
      INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
      VALUES (?, ?, ?, 'TOURNAMENT', ?, ?, ?, ?, ?, ?, ?)
    `, [
      txId,
      now.split('T')[0],
      new Date().toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      id,
      fee,
      paymentMethod,
      req.user!.id,
      req.user!.fullName,
      `ტურნირი: ${tournament.name} - მონაწილე: ${actualNick}`,
      now
    ]);
  }

  logAudit(req.user, 'ADD_TOURNAMENT_PARTICIPANT', 'TOURNAMENT_PARTICIPANT', partId, null, { tournamentId: id, nickname: actualNick, fee, paymentStatus: actualPaid }, req.ip);

  res.json({ success: true, message: 'მონაწილე წარმატებით დარეგისტრირდა.', participantId: partId });
};

tournamentRouter.post('/:id/participants', authMiddleware, requirePermission('tournament.edit'), handleAddParticipant);
tournamentRouter.post('/:id/register', authMiddleware, requirePermission('tournament.edit'), handleAddParticipant);

// Delete tournament
tournamentRouter.delete('/:id', authMiddleware, requirePermission('tournament.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'ტურნირი ვერ მოიძებნა.' });
    return;
  }
  execute('DELETE FROM tournament_participants WHERE tournament_id = ?', [id]);
  execute('DELETE FROM tournaments WHERE id = ?', [id]);
  logAudit(req.user, 'DELETE_TOURNAMENT', 'TOURNAMENT', id, existing, null, req.ip);
  res.json({ success: true, message: 'ტურნირი წარმატებით წაიშალა.' });
});

// Update participant payment status
tournamentRouter.post('/participants/:participantId/pay', authMiddleware, requirePermission('tournament.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { participantId } = req.params;
  const { paymentMethod = PaymentMethod.CASH } = req.body;

  const part = queryOne<any>('SELECT * FROM tournament_participants WHERE id = ?', [participantId]);
  if (!part) {
    res.status(404).json({ error: 'მონაწილე ვერ მოიძებნა.' });
    return;
  }

  if (part.payment_status === 'PAID') {
    res.status(400).json({ error: 'შესატანი უკვე გადახდილია.' });
    return;
  }

  const now = new Date().toISOString();
  execute(`UPDATE tournament_participants SET payment_status = 'PAID', payment_method = ? WHERE id = ?`, [paymentMethod, participantId]);

  if (part.entry_fee > 0) {
    const txId = generateId('tx');
    execute(`
      INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
      VALUES (?, ?, ?, 'TOURNAMENT', ?, ?, ?, ?, ?, ?, ?)
    `, [
      txId,
      now.split('T')[0],
      new Date().toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      part.tournament_id,
      part.entry_fee,
      paymentMethod,
      req.user!.id,
      req.user!.fullName,
      `ტურნირის შესატანი: ${part.nickname}`,
      now
    ]);
  }

  logAudit(req.user, 'PAY_TOURNAMENT_FEE', 'TOURNAMENT_PARTICIPANT', participantId, { status: 'PENDING' }, { status: 'PAID', method: paymentMethod }, req.ip);

  res.json({ success: true, message: 'გადახდა წარმატებით დაფიქსირდა.' });
});

// მონაწილის რედაქტირება
tournamentRouter.put('/participants/:participantId', authMiddleware, requirePermission('tournament.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { participantId } = req.params;
  const { name, surname, nickname, phone, email, entryFee, paymentMethod, paymentStatus, notes } = req.body;

  const existing = queryOne<any>('SELECT * FROM tournament_participants WHERE id = ?', [participantId]);
  if (!existing) {
    res.status(404).json({ error: 'მონაწილე ვერ მოიძებნა.' });
    return;
  }

  const newFee = entryFee !== undefined ? Number(entryFee) : existing.entry_fee;
  const newStatus = paymentStatus || existing.payment_status;
  const newMethod = paymentMethod || existing.payment_method;

  execute(`
    UPDATE tournament_participants SET
      name = ?, surname = ?, nickname = ?, phone = ?, email = ?,
      entry_fee = ?, payment_method = ?, payment_status = ?, notes = ?
    WHERE id = ?
  `, [
    name ?? existing.name, surname !== undefined ? surname : existing.surname,
    nickname ?? existing.nickname, phone ?? existing.phone,
    email !== undefined ? email : existing.email,
    newFee, newMethod, newStatus, notes !== undefined ? notes : existing.notes,
    participantId
  ]);

  // გადახდის სტატუსის ცვლილება აისახება სალაროზე
  const tx = queryOne<any>(`SELECT * FROM transactions WHERE source = 'TOURNAMENT' AND notes LIKE ?`, [`%${existing.nickname}%`]);
  if (newStatus !== 'PAID' && tx) {
    execute('DELETE FROM transactions WHERE id = ?', [tx.id]);
  } else if (newStatus === 'PAID' && tx) {
    execute('UPDATE transactions SET amount = ?, payment_method = ? WHERE id = ?', [newFee, newMethod, tx.id]);
  } else if (newStatus === 'PAID' && !tx && newFee > 0) {
    const now = new Date().toISOString();
    execute(`
      INSERT INTO transactions (id, date, time, source, source_id, amount, payment_method, created_by_id, created_by_name, notes, created_at)
      VALUES (?, ?, ?, 'TOURNAMENT', ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateId('tx'), now.split('T')[0],
      new Date().toLocaleTimeString('ka-GE', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      existing.tournament_id, newFee, newMethod, req.user!.id, req.user!.fullName,
      `ტურნირის შესატანი: ${nickname ?? existing.nickname}`, now
    ]);
  }

  logAudit(req.user, 'UPDATE_TOURNAMENT_PARTICIPANT', 'TOURNAMENT_PARTICIPANT', participantId, existing, req.body, req.ip);
  res.json({ success: true, message: 'მონაწილის მონაცემები განახლდა.' });
});

// მონაწილის წაშლა
tournamentRouter.delete('/participants/:participantId', authMiddleware, requirePermission('tournament.edit'), (req: AuthenticatedRequest, res: Response): void => {
  const { participantId } = req.params;
  const existing = queryOne<any>('SELECT * FROM tournament_participants WHERE id = ?', [participantId]);
  if (!existing) {
    res.status(404).json({ error: 'მონაწილე ვერ მოიძებნა.' });
    return;
  }

  if (existing.voucher_code) {
    execute(`UPDATE vouchers SET status = 'ACTIVE', used_at = NULL WHERE code = ?`, [existing.voucher_code]);
  }
  execute(`DELETE FROM transactions WHERE source = 'TOURNAMENT' AND notes LIKE ?`, [`%${existing.nickname}%`]);
  execute('DELETE FROM tournament_participants WHERE id = ?', [participantId]);

  logAudit(req.user, 'DELETE_TOURNAMENT_PARTICIPANT', 'TOURNAMENT_PARTICIPANT', participantId, existing, null, req.ip);
  res.json({ success: true, message: 'მონაწილე წაიშალა.' });
});

// ონლაინ რეგისტრაციების ერთიანი ნაკადი (ადმინისთვისაც და ოპერატორისთვისაც)
tournamentRouter.get('/registrations/all', authMiddleware, (req, res): void => {
  const rows = queryAll<any>(`
    SELECT p.*, t.name as tournament_name, t.tournament_date, t.start_time, t.game
    FROM tournament_participants p
    JOIN tournaments t ON t.id = p.tournament_id
    ORDER BY p.registered_at DESC
    LIMIT 300
  `);

  const registrations = rows.map(p => ({
    id: p.id,
    tournamentId: p.tournament_id,
    tournamentName: p.tournament_name,
    tournamentDate: p.tournament_date,
    startTime: p.start_time,
    game: p.game,
    name: p.name,
    surname: p.surname || undefined,
    nickname: p.nickname,
    phone: p.phone,
    email: p.email || undefined,
    entryFee: p.entry_fee,
    paymentMethod: p.payment_method,
    paymentStatus: p.payment_status,
    source: p.source || 'STAFF',
    isPublicRegistration: p.source === 'PUBLIC_LINK',
    registeredAt: p.registered_at,
    notes: p.notes || undefined
  }));

  res.json({
    registrations,
    onlineCount: registrations.filter(r => r.isPublicRegistration).length,
    pendingPaymentCount: registrations.filter(r => r.paymentStatus !== 'PAID').length
  });
});
