import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  Clock,
  PieChart as PieIcon,
  Trophy,
  RefreshCw,
  AlertCircle,
  Wallet,
  Users,
  Timer,
  Percent
} from 'lucide-react';

const COLORS = ['#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#ec4899'];

interface ReportsData {
  period: { startDate: string; endDate: string; days: number };
  summary: {
    totalRevenue: number;
    totalCash: number;
    totalCard: number;
    totalTransfer: number;
    totalTournamentRevenue: number;
    totalSessionsCount: number;
    totalSessionHours: number;
    averageSessionValue: number;
    averageDailyRevenue: number;
    totalDiscountsGiven: number;
    totalUnpaidAmount: number;
    totalStaffPayouts: number;
    netAfterPayouts: number;
    totalFitpassSessions: number;
    totalFitpassHours: number;
    totalVoucherSessions: number;
    totalExtraControllersRevenue: number;
    bestDay: { date: string; revenue: number } | null;
    peakHour: { hour: string; sessionsCount: number } | null;
  };
  dailyTrend: { date: string; label: string; revenue: number; cash: number; card: number; sessionsCount: number }[];
  hourlyDistribution: { hour: string; revenue: number; sessionsCount: number }[];
  categoryBreakdown: { category: string; label: string; sessionsCount: number; totalMinutes: number; hours: number; totalRevenue: number }[];
  devicePerformance: { deviceId: string; deviceName: string; category: string; sessionsCount: number; totalMinutes: number; totalRevenue: number }[];
}

const RANGES = [
  { days: 7, label: '7 დღე' },
  { days: 14, label: '14 დღე' },
  { days: 30, label: '30 დღე' },
  { days: 90, label: '3 თვე' }
];

const tooltipStyle = {
  backgroundColor: '#0f172a',
  borderColor: '#334155',
  borderRadius: '12px',
  fontSize: '12px'
};

const KpiCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}> = ({ icon: Icon, label, value, hint, accent }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
    <div className="flex items-center gap-2 mb-2">
      <div className={`p-1.5 rounded-lg border ${accent}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-xl font-black text-white font-mono tracking-tight">{value}</div>
    {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

export const ReportsView: React.FC = () => {
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<ReportsData>(`/finance/reports?days=${rangeDays}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'ანალიტიკის ჩატვირთვა ვერ მოხერხდა.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* სათაური და ფილტრები */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <span>ანალიტიკა & ანგარიშგება</span>
          </h2>
          <p className="text-xs text-slate-400">
            {data
              ? `პერიოდი: ${data.period.startDate} — ${data.period.endDate}`
              : 'შემოსავლების დინამიკა, პიკური საათები და მოწყობილობების რეიტინგი'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            {RANGES.map(r => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRangeDays(r.days)}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  rangeDays === r.days ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchReports}
            title="განახლება"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchReports}
            className="ml-auto px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 font-semibold cursor-pointer"
          >
            ხელახლა ცდა
          </button>
        </div>
      )}

      {/* KPI ბარათები */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Wallet}
            label="სულ შემოსავალი"
            value={`${summary.totalRevenue.toFixed(2)} ₾`}
            hint={`ნაღდი ${summary.totalCash.toFixed(0)} • ბარათი ${summary.totalCard.toFixed(0)}`}
            accent="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          />
          <KpiCard
            icon={Users}
            label="სესიები"
            value={String(summary.totalSessionsCount)}
            hint={`საშუალო ჩეკი ${summary.averageSessionValue.toFixed(2)} ₾`}
            accent="bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
          />
          <KpiCard
            icon={Timer}
            label="ნათამაშები საათები"
            value={`${summary.totalSessionHours} სთ`}
            hint={summary.peakHour ? `პიკი: ${summary.peakHour.hour}` : 'პიკი: —'}
            accent="bg-purple-500/10 border-purple-500/30 text-purple-400"
          />
          <KpiCard
            icon={Percent}
            label="პერსონალის ანაზღაურება"
            value={`${summary.totalStaffPayouts.toFixed(2)} ₾`}
            hint={`წმინდა: ${summary.netAfterPayouts.toFixed(2)} ₾`}
            accent="bg-amber-500/10 border-amber-500/30 text-amber-400"
          />
        </div>
      )}

      {/* ორი მთავარი გრაფიკი */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">დღიური შემოსავალი (₾)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">ბოლო {rangeDays} დღე</span>
          </div>

          <div className="h-64 w-full">
            {data && data.dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyTrend}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#38bdf8' }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#revGradient)"
                    name="შემოსავალი (₾)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                {loading ? 'იტვირთება...' : 'მონაცემები არ არის'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">პიკური საათების დატვირთვა</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">24-საათიანი განაწილება</span>
          </div>

          <div className="h-64 w-full">
            {data && data.hourlyDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} tickLine={false} interval={1} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#c084fc' }} />
                  <Bar dataKey="sessionsCount" fill="#a855f7" radius={[4, 4, 0, 0]} name="სესიები" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                {loading ? 'იტვირთება...' : 'მონაცემები არ არის'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ზონები + რეიტინგი */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <PieIcon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">ზონების წილი</h3>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            {data && data.categoryBreakdown.some(c => c.totalRevenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown.filter(c => c.totalRevenue > 0)}
                    dataKey="totalRevenue"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {data.categoryBreakdown.filter(c => c.totalRevenue > 0).map((entry, index) => (
                      <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-xs">{loading ? 'იტვირთება...' : 'მონაცემები არ არის'}</div>
            )}
          </div>

          {data && (
            <div className="space-y-1.5">
              {data.categoryBreakdown.map(c => (
                <div key={c.category} className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{c.label}</span>
                  <span className="font-mono text-slate-200">
                    {c.sessionsCount} სესია • {c.totalRevenue.toFixed(2)} ₾
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Trophy className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">მოწყობილობების რეიტინგი</h3>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 min-w-[520px]">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">მოწყობილობა</th>
                  <th className="p-3">ზონა</th>
                  <th className="p-3 text-center">სესიები</th>
                  <th className="p-3 text-right">ნათამაშები დრო</th>
                  <th className="p-3 text-right">შემოსავალი</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data && data.devicePerformance.length > 0 ? (
                  data.devicePerformance.map((d, idx) => (
                    <tr key={d.deviceId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-semibold text-white">{d.deviceName}</td>
                      <td className="p-3 text-[11px] uppercase font-mono text-slate-400">{d.category}</td>
                      <td className="p-3 text-center font-mono">{d.sessionsCount}</td>
                      <td className="p-3 text-right font-mono text-cyan-400">
                        {Math.floor(d.totalMinutes / 60)} სთ {d.totalMinutes % 60} წთ
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        {d.totalRevenue.toFixed(2)} ₾
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      {loading ? 'იტვირთება...' : 'რეიტინგის მონაცემები არ არის'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* დამატებითი მაჩვენებლები */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Wallet}
            label="ფასდაკლებები"
            value={`${summary.totalDiscountsGiven.toFixed(2)} ₾`}
            accent="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          />
          <KpiCard
            icon={AlertCircle}
            label="გადაუხდელი"
            value={`${summary.totalUnpaidAmount.toFixed(2)} ₾`}
            hint="შეწყვეტილი სესიები"
            accent="bg-red-500/10 border-red-500/30 text-red-400"
          />
          <KpiCard
            icon={Trophy}
            label="ტურნირები"
            value={`${summary.totalTournamentRevenue.toFixed(2)} ₾`}
            accent="bg-amber-500/10 border-amber-500/30 text-amber-400"
          />
          <KpiCard
            icon={TrendingUp}
            label="საუკეთესო დღე"
            value={summary.bestDay ? `${summary.bestDay.revenue.toFixed(0)} ₾` : '—'}
            hint={summary.bestDay ? summary.bestDay.date : undefined}
            accent="bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
          />
        </div>
      )}
    </div>
  );
};
