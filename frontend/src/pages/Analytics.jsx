import { useState } from 'react'
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts'
import { useApi } from '../hooks/useApi'
import StatCard from '../components/StatCard'

function formatMoney(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function Analytics() {
  const [days, setDays] = useState(30)
  const { data, loading, error, refetch } = useApi(`/analytics?days=${days}`)

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Analytics</h2>
        </div>
        <div className="stat-card flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--talon-accent)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--talon-muted)' }}>Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Analytics</h2>
        </div>
        <div className="stat-card text-center py-8">
          <p className="text-sm" style={{ color: 'var(--talon-yellow)' }}>
            No analytics data available yet. Run a trading session first, then return here.
          </p>
        </div>
      </div>
    )
  }

  const {
    total_pnl = 0, win_rate = 0, best_day = 0, worst_day = 0,
    daily_pnl = [], symbol_pnl = [], exit_distribution = [],
    rule_performance = [], equity_history = [],
  } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Analytics</h2>
          <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
            Performance metrics and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-2 py-1.5 rounded-lg text-sm border"
            style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button onClick={refetch} className="p-1.5 rounded-lg hover:bg-white/5"
            title="Refresh">
            <RefreshCw size={16} style={{ color: 'var(--talon-muted)' }} />
          </button>
        </div>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total P&L" value={formatMoney(total_pnl)}
          color={total_pnl >= 0 ? 'var(--talon-green)' : 'var(--talon-red)'} icon={TrendingUp} />
        <StatCard label="Win Rate" value={`${win_rate}%`}
          color={win_rate >= 50 ? 'var(--talon-green)' : 'var(--talon-yellow)'} />
        <StatCard label="Best Day" value={formatMoney(best_day)} color="var(--talon-green)" />
        <StatCard label="Worst Day" value={formatMoney(worst_day)} color="var(--talon-red)" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily P&L Bar Chart */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Daily P&L
          </h3>
          <div className="h-64">
            {daily_pnl.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily_pnl}>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                    formatter={(v) => [formatMoney(v), 'P&L']} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {daily_pnl.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm"
                style={{ color: 'var(--talon-muted)' }}>No daily data yet</div>
            )}
          </div>
        </div>

        {/* Equity History */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Equity Curve
          </h3>
          <div className="h-64">
            {equity_history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equity_history}>
                  <defs>
                    <linearGradient id="eqHistGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }}
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
            ) : (
              <div className="flex items-center justify-center h-full text-sm"
                style={{ color: 'var(--talon-muted)' }}>No equity data yet</div>
            )}
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
            {symbol_pnl.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symbol_pnl} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="symbol" tick={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
                    axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                    formatter={(v) => [formatMoney(v), 'P&L']} />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {symbol_pnl.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm"
                style={{ color: 'var(--talon-muted)' }}>No symbol data yet</div>
            )}
          </div>
        </div>

        {/* Exit Distribution */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Exit Distribution
          </h3>
          <div className="h-48">
            {exit_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={exit_distribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                    dataKey="value" paddingAngle={3}>
                    {exit_distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm"
                style={{ color: 'var(--talon-muted)' }}>No exit data yet</div>
            )}
          </div>
          {exit_distribution.length > 0 && (
            <div className="space-y-1 mt-2">
              {exit_distribution.map((e) => (
                <div key={e.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                    <span style={{ color: 'var(--talon-muted)' }}>{e.name}</span>
                  </div>
                  <span style={{ color: 'var(--talon-text)' }}>{e.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rule Performance Table */}
      {rule_performance.length > 0 && (
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
                {rule_performance.map((r) => (
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
      )}
    </div>
  )
}
