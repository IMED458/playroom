export enum RoleName {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  FINANCE = 'FINANCE',
  EMPLOYEE = 'EMPLOYEE',
}

export enum DeviceCategory {
  PC = 'PC',
  PLAYSTATION = 'PLAYSTATION',
  WHEEL = 'WHEEL',
}

export enum DeviceStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE',
  RESERVED = 'RESERVED',
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  FITPASS = 'FITPASS',
  VOUCHER = 'VOUCHER',
  MIXED = 'MIXED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  UNPAID = 'UNPAID',
  CANCELLED = 'CANCELLED',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  FIXED_AMOUNT = 'FIXED',
}

export enum TransactionSource {
  GAME_SESSION = 'GAME_SESSION',
  TOURNAMENT = 'TOURNAMENT',
  TOURNAMENT_ENTRY = 'TOURNAMENT_ENTRY',
  MANUAL_INCOME = 'MANUAL_INCOME',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  PRODUCT_SALE = 'PRODUCT_SALE',
}

export interface PriceCalculationResult {
  basePrice: number;
  extraControllersPrice: number;
  discountAmount: number;
  voucherCoveredAmount: number;
  fitPassRetailValue: number;
  finalPrice: number;
  effectiveDurationMinutes: number;
  breakdown: {
    hourlyRate: number;
    durationMinutes: number;
    extraControllersCount: number;
    extraControllerRate: number;
  };
}

export type Attendance = AttendanceRecord;

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  PENDING = 'PENDING',
  CONVERTED = 'CONVERTED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export interface Reservation {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceCategory: DeviceCategory;
  customerName: string;
  customerPhone: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string (optional)
  depositAmount: number;
  notes?: string;
  status: ReservationStatus;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export enum VoucherStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum TournamentStatus {
  PLANNED = 'PLANNED',
  REGISTRATION_OPEN = 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ExtraPriceMode {
  FIXED = 'FIXED',
  HOURLY = 'HOURLY',
}

export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  passwordHint?: string;
  fullName: string;
  role: RoleName;
  permissions: string[];
  active: boolean;
  employeeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  name: string;
  category: DeviceCategory;
  orderIndex: number;
  status: DeviceStatus;
  notes?: string;
  active: boolean;
  currentSessionId?: string;
  currentSession?: Session;
  hourlyPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceCategory: DeviceCategory;
  startTime: string; // ISO string
  plannedDurationMinutes: number;
  plannedEndTime: string;
  actualEndTime?: string;
  usedMinutes: number;
  hourlyRate: number;
  basePrice: number;
  discountId?: string;
  discountName?: string;
  discountAmount: number;
  manualDiscountReason?: string;
  extraControllersCount: number;
  extraControllersPrice: number;
  voucherCode?: string;
  voucherMinutes: number;
  voucherCoveredAmount: number;
  isFitPass: boolean;
  fitPassRetailValue: number;
  finalPrice: number;
  customerPaidAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerName?: string;
  customerPhone?: string;
  comment?: string;
  status: SessionStatus;
  /** „მიმდინარე" სესია — ხანგრძლივობა წინასწარ არ არის განსაზღვრული */
  isOpen?: boolean;
  /** შეწყვეტისას გადაუხდელი ნაშთი */
  unpaidAmount?: number;
  terminatedReason?: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountRule {
  id: string;
  name: string;
  description?: string;
  deviceCategory?: DeviceCategory | 'ALL';
  minDurationMinutes: number;
  maxDurationMinutes?: number;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Voucher {
  id: string;
  code: string;
  durationMinutes: number;
  deviceCategory?: DeviceCategory | 'ALL';
  specificDeviceId?: string;
  status: VoucherStatus;
  createdById: string;
  createdByName: string;
  usedSessionId?: string;
  usedById?: string;
  usedByName?: string;
  usedAt?: string;
  expirationDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  role: RoleName;
  hourlySalary: number;
  /** დღის შემოსავლიდან კუთვნილი პროცენტი */
  revenuePercent: number;
  status: 'ACTIVE' | 'INACTIVE';
  startDate: string;
  notes?: string;
  createdAt: string;
  userId?: string;
}

export interface ShiftDefinition {
  id: string;
  name: string;
  startTime: string; // e.g. "10:00"
  endTime: string; // e.g. "18:00" or "02:00"
  isOvernight: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  shiftName?: string;
  startTime: string; // ISO
  endTime?: string; // ISO
  workedHours: number;
  hourlyRate: number;
  earnedAmount: number;
  notes?: string;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string; // e.g. "2026-08"
  totalWorkedHours: number;
  hourlyRate: number;
  baseSalary: number;
  bonus: number;
  bonusReason?: string;
  deduction: number;
  deductionReason?: string;
  finalSalary: number;
  paymentStatus: 'PENDING' | 'PAID';
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

/** დღის შემოსავლიდან პერსონალის პროცენტული ანაზღაურება */
export interface StaffPayout {
  id: string;
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  revenueBase: number;
  percent: number;
  amount: number;
  manualAdjustment: number;
  status: PayoutStatus;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  game: string;
  deviceCategory: DeviceCategory;
  tournamentDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  maxParticipants: number;
  entryFee: number;
  prizePool: string;
  status: TournamentStatus;
  notes?: string;
  participantsCount: number;
  paidParticipantsCount: number;
  totalCollected: number;
  expectedRevenue: number;
  createdAt: string;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  name: string;
  surname?: string;
  nickname: string;
  phone: string;
  entryFee: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  voucherCode?: string;
  registeredAt: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  source: 'GAME_SESSION' | 'TOURNAMENT' | 'TOURNAMENT_ENTRY' | 'MANUAL_INCOME' | 'MANUAL_ADJUSTMENT' | string;
  sourceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdById: string;
  createdByName: string;
  notes?: string;
  createdAt: string;
}

export interface DailyClosure {
  id: string;
  date: string; // YYYY-MM-DD
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
  cardTotal: number;
  transferTotal: number;
  totalRevenue: number;
  fitpassCount: number;
  voucherCount: number;
  closedById: string;
  closedByName: string;
  closedAt: string;
  comment?: string;
  isLocked: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeValue?: string;
  afterValue?: string;
  timestamp: string;
  ipAddress?: string;
}

export interface SettingsState {
  businessName: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  pcHourlyPrice: number;
  psHourlyPrice: number;
  wheelHourlyPrice: number;
  extraControllerMode: ExtraPriceMode;
  extraControllerPrice: number;
  minDurationMinutes: number;
  timeIncrementMinutes: number;
  roundingMode: 'PREPAID_FIXED' | 'ROUND_UP_30_MIN';
  soundEnabled: boolean;
  /** პერსონალის პროცენტული ანაზღაურება ჩართულია */
  staffPayoutEnabled: boolean;
  /** გამოთვლის ბაზა: მთლიანი შემოსავალი თუ მხოლოდ ნაღდი */
  staffPayoutBase: 'TOTAL_REVENUE' | 'CASH_ONLY';
  staffPayoutDefaultPercent: number;
  /** მხოლოდ იმ დღეს ნამუშევარ პერსონალზე გაიცეს */
  staffPayoutOnlyWorkedShifts: boolean;
  /** „მიმდინარე" სესიის მინიმალური ასაღები დრო */
  openSessionMinMinutes: number;
  shifts: ShiftDefinition[];
}

export interface FinancialStats {
  todayRevenue: number;
  monthRevenue: number;
  todayCash: number;
  todayCard: number;
  todayTransfer: number;
  todayFitpassSessions: number;
  todayFitpassHours: number;
  todayFitpassNominalValue: number;
  todayVoucherSessions: number;
  todayVoucherMinutes: number;
  todayDiscountsTotal: number;
  todayTournamentsRevenue: number;
  todayTotalSessions: number;
  activeSessionsCount: number;
  availableDevicesCount: {
    PC: number;
    PLAYSTATION: number;
    WHEEL: number;
    total: number;
  };
}
