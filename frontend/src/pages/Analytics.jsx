import { useState } from 'react'
import {
  BarChart3, TrendingUp,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts'
import StatCard from '../components/StatCard'

function formatMoney(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

const MOCK_DAILY_PNL = [
  { date: 'Mar 10', pnl: 245 },
  { date: 'Mar 11', pnl: -180 },
  { date: 'Mar 12', pnl: 420 },
  { date: 'Mar 13', pnl: -95 },
  { date: 'Mar 14', pnl: 310 },
  { date: 'Mar 15', pnl: 150 },
  { date: 'Mar 16', pnl: -220 },
]

const MOCK_RULE_PERF = [
  { rule: 'momentum_pnl', trades: 39, win_rate: 48.7, pnl: 160.25, sharpe: 0.44, profit_factor: 1.32 },
]

const MOCK_SYMBOL_PNL = [
  { symbol: 'NVDA', pnl: 320 },
  { symbol: 'AMD', pnl: 180 },
  { symbol: 'PLTR', pnl: 125 },
  { symbol: 'TSLA', pnl: -95 },
  { symbol: 'COIN', pnl: -210 },
  { symbol: 'AAPL', pnl: 60 },
]

const MOCK_EXIT_DIST = [
  { name: 'TAKE_PROFIT', value: 19, color: 'var(--talon-green)' },
  { name: 'STOP_LOSS', value: 12, color: 'var(--talon-red)' },
  { name: 'MAX_HOLD', value: 6, color: 'var(--talon-yellow)' },
  { name: 'TRAILING_STOP', value: 2, color: 'var(--talon-accent)' },
]

const MOCK_EQUITY_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  equity: 100000 + (Math.sin(i * 0.5) * 800 + i * 50 + (Math.random() - 0.3) * 300),
}))

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Analytics</h2>
        <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
          Performance metrics and insights
        </p>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total P&L" value={formatMoney(630)} color="var(--talon-green)" icon={TrendingUp} />
        <StatCard label="Win Rate" value="48.7%" color="var(--talon-yellow)" />
        <StatCard label="Best Day" value={formatMoney(420)} color="var(--talon-green)" />
        <StatCard label="Worst Day" value={formatMoney(-220)} color="var(--talon-red)" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily P&L Bar Chart */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Daily P&L
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_DAILY_PNL}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v) => [formatMoney(v), 'P&L']} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {MOCK_DAILY_PNL.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Equity History */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Equity Curve (30 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_EQUITY_HISTORY}>
                <defs>
                  <linearGradient id="eqHistGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v) => [formatMoney(v), 'Equity']} />
                <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2}
                  fill="url(#eqHistGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* P&L by Symbol */}
        <div className="stat-card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            P&L by Symbol
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_SYMBOL_PNL} layout="vertical">
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="symbol" tick={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
                  axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v) => [formatMoney(v), 'P&L']} />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {MOCK_SYMBOL_PNL.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Exit Distribution */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Exit Distribution
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={MOCK_EXIT_DIST} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                  dataKey="value" paddingAngle={3}>
                  {MOCK_EXIT_DIST.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {MOCK_EXIT_DIST.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                  <span style={{ color: 'var(--talon-muted)' }}>{e.name}</span>
                </div>
                <span style={{ color: 'var(--talon-text)' }}>{e.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rule Performance Table */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
          Performance by Rule
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--talon-muted)' }}>
                <th className="text-left py-2 px-3 font-medium">Rule</th>
                <th className="text-right py-2 px-3 font-medium">Trades</th>
                <th className="text-right py-2 px-3 font-medium">Win Rate</th>
                <th className="text-right py-2 px-3 font-medium">Net P&L</th>
                <th className="text-right py-2 px-3 font-medium">Profit Factor</th>
                <th className="text-right py-2 px-3 font-medium">Sharpe</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_RULE_PERF.map((r) => (
                <tr key={r.rule} className="border-t" style={{ borderColor: 'var(--talon-border)' }}>
                  <td className="py-3 px-3 font-bold" style={{ color: 'var(--talon-accent)' }}>{r.rule}</td>
                  <td className="py-3 px-3 text-right">{r.trades}</td>
                  <td className="py-3 px-3 text-right"
                    style={{ color: r.win_rate >= 50 ? 'var(--talon-green)' : 'var(--talon-yellow)' }}>
                    {r.win_rate}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono"
                    style={{ color: r.pnl >= 0 ? 'var(--talon-green)' : 'var(--talon-red)' }}>
                    {formatMoney(r.pnl)}
                  </td>
                  <td className="py-3 px-3 text-right">{r.profit_factor}</td>
                  <td className="py-3 px-3 text-right">{r.sharpe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
