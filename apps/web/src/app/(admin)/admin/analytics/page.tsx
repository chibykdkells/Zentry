'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Download, RefreshCw, TrendingUp, Users, Wallet, Briefcase } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useAnalyticsOverview,
  useRevenueSeries,
  useUserGrowth,
  type AnalyticsPeriod,
} from '@/hooks/use-analytics';
import { formatNaira } from '@/lib/format';

const PERIODS: Array<{ label: string; value: AnalyticsPeriod }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

function formatPeriodLabel(iso: string, period: AnalyticsPeriod): string {
  const d = new Date(iso);
  if (period === 'monthly') return d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' });
  if (period === 'weekly') return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

function handleExport(type: 'orders' | 'transactions') {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  window.open(`${base}/analytics/admin/export/${type}`, '_blank');
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
  const { overview, loading, error, reload } = useAnalyticsOverview();
  const { data: revenueSeries } = useRevenueSeries(period, 30);
  const { data: userGrowthSeries } = useUserGrowth(period, 30);

  const revenueChartData = revenueSeries.map((p) => ({
    name: formatPeriodLabel(p.period, period),
    revenue: Number(p.revenue) / 100, // convert kobo → naira for display
    orders: p.orderCount,
  }));

  const userGrowthChartData = userGrowthSeries.map((p) => ({
    name: formatPeriodLabel(p.period, period),
    newUsers: p.newUsers,
    total: p.cumulative,
  }));

  const ordersByServiceData = (overview?.ordersByService ?? []).map((s) => ({
    name: s.serviceName.length > 18 ? s.serviceName.slice(0, 16) + '…' : s.serviceName,
    fullName: s.serviceName,
    orders: s.orderCount,
  }));

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-28 rounded-[2rem]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28 rounded-[1.5rem]" />
          ))}
        </div>
        <SkeletonBlock className="h-72 rounded-[1.5rem]" />
        <div className="grid gap-5 xl:grid-cols-2">
          <SkeletonBlock className="h-72 rounded-[1.5rem]" />
          <SkeletonBlock className="h-72 rounded-[1.5rem]" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <EmptyState
          title="Analytics unavailable"
          message={error ?? 'Could not load platform analytics'}
          icon={TrendingUp}
          action={
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const { walletFloat, cbtPerformance } = overview;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Analytics"
        title="Platform performance overview"
        description="Revenue trends, service demand, CBT output, and user growth across your platform."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExport('orders')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download size={14} />
              Orders CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('transactions')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Download size={14} />
              Transactions CSV
            </button>
          </div>
        }
      />

      {/* Wallet float summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total escrowed',
            value: formatNaira(walletFloat.totalEscrowed),
            icon: Wallet,
            color: 'text-amber-600',
          },
          {
            label: 'Platform balance',
            value: formatNaira(walletFloat.platformBalance),
            icon: TrendingUp,
            color: 'text-emerald-600',
          },
          {
            label: 'CBT available',
            value: formatNaira(walletFloat.totalCbtAvailable),
            icon: Briefcase,
            color: 'text-blue-600',
          },
          {
            label: 'User wallet total',
            value: formatNaira(walletFloat.totalUserAvailable),
            icon: Users,
            color: 'text-purple-600',
          },
        ].map((card) => (
          <article
            key={card.label}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ${card.color}`}>
              <card.icon size={18} />
            </div>
            <p className="mt-4 text-xl font-bold tracking-tight text-slate-900">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{card.label}</p>
          </article>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              period === p.value
                ? 'border-[#0D1B3E] bg-[#0D1B3E] text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Revenue chart */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Platform revenue (₦)</h2>
        <p className="mt-1 text-xs text-slate-400">
          Combined platform commissions and automated service revenue
        </p>
        <div className="mt-6 h-64">
          {revenueChartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatNaira(String(Math.round(value * 100))),
                    'Revenue',
                  ]}
                  labelStyle={{ fontSize: 12, color: '#1e293b' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0D1B3E"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No revenue data for this period
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Orders by service */}
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-sm font-semibold text-slate-900">Orders by service</h2>
          <p className="mt-1 text-xs text-slate-400">Top 10 services by order volume</p>
          <div className="mt-6 h-64">
            {ordersByServiceData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ordersByServiceData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, 'Orders']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="orders" fill="#F5A623" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No order data yet
              </div>
            )}
          </div>
        </section>

        {/* User growth */}
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-sm font-semibold text-slate-900">User growth</h2>
          <p className="mt-1 text-xs text-slate-400">New registrations and running total</p>
          <div className="mt-6 h-64">
            {userGrowthChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={userGrowthChartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value) => value === 'newUsers' ? 'New users' : 'Total users'}
                  />
                  <Line
                    type="monotone"
                    dataKey="newUsers"
                    stroke="#0891B2"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#0D1B3E"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No user data yet
              </div>
            )}
          </div>
        </section>
      </div>

      {/* CBT performance */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-semibold text-slate-900">CBT performance</h2>
        <p className="mt-1 text-xs text-slate-400">Fulfillment health and top earners</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Jobs completed', value: cbtPerformance.totalCompleted },
            { label: 'Disputes raised', value: cbtPerformance.totalDisputed },
            { label: 'Dispute rate', value: `${cbtPerformance.disputeRate}%` },
            { label: 'Approved CBTs', value: `${cbtPerformance.approvedCbts} / ${cbtPerformance.totalCbts}` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{stat.label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {cbtPerformance.topPerformers.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Top performers
            </p>
            <div className="mt-3 space-y-2">
              {cbtPerformance.topPerformers.map((p, i) => (
                <div
                  key={p.cbtId ?? i}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0D1B3E]/10 text-xs font-bold text-[#0D1B3E]">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{p.name || 'Unknown'}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatNaira(p.totalEarned)}
                    </p>
                    <p className="text-xs text-slate-400">{p.jobsCompleted} jobs</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
