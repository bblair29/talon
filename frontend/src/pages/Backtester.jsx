import { useState } from 'react'
import {
  FlaskConical, Play, Loader2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import StatCard from '../components/StatCard'
import PnlBadge from '../components/PnlBadge'
import { postApi } from '../hooks/useApi'

const SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMD', 'META', 'AMZN', 'GOOG', 'NFLX', 'BA', 'COIN', 'PLTR', 'SOFI', 'UBER', 'ROKU', 'SHOP', 'CRWD', 'PANW', 'SNOW', 'DKNG', 'HOOD', 'AFRM', 'MARA', 'SMCI', 'ARM', 'MSTR']
const RULES = ['scalper', 'vwap_reversion', 'momentum_pnl', 'rsi_oversold_trailing']
const TIMEFRAMES = ['1Min', '5Min', '15Min', '1Hour']
const LOOKBACKS = [7, 14, 30, 60, 90]

function formatMoney(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function Backtester() {
  const [form, setForm] = useState({
    symbol: 'NVDA',
    rule: 'momentum_pnl',
    timeframe: '5Min',
    lookback: 30,
    equity: 100000,
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const runBacktest = async () => {
    setRunning(true)
    setResult(null)
    try {
      const data = await postApi('/backtest', form)
      setResult(data)
    } catch (err) {
      alert(`Backtest failed: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Backtester</h2>
        <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
          Validate rules against historical data
        </p>
      </div>

      {/* Config Panel */}
      <div className="stat-card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--talon-muted)' }}>Symbol</label>
            <select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}>
              {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--talon-muted)' }}>Rule</label>
            <select value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}>
              {RULES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--talon-muted)' }}>Timeframe</label>
            <select value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}>
              {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--talon-muted)' }}>Lookback (days)</label>
            <select value={form.lookback} onChange={(e) => setForm({ ...form, lookback: +e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}>
              {LOOKBACKS.map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={runBacktest} disabled={running}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
              style={{ background: 'var(--talon-accent)' }}>
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? 'Running...' : 'Run Backtest'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Total Return" value={`${result.total_return_pct}%`}
              color={result.total_return_pct >= 0 ? 'var(--talon-green)' : 'var(--talon-red)'} />
            <StatCard label="Total P&L" value={formatMoney(result.total_pnl)}
              color={result.total_pnl >= 0 ? 'var(--talon-green)' : 'var(--talon-red)'} />
            <StatCard label="Win Rate" value={`${result.win_rate}%`}
              color={result.win_rate >= 50 ? 'var(--talon-green)' : 'var(--talon-yellow)'} />
            <StatCard label="Trades" value={result.total_trades} />
            <StatCard label="Profit Factor" value={result.profit_factor}
              color={result.profit_factor >= 1.5 ? 'var(--talon-green)' : 'var(--talon-yellow)'} />
            <StatCard label="Sharpe Ratio" value={result.sharpe_ratio}
              color={result.sharpe_ratio >= 1 ? 'var(--talon-green)' : 'var(--talon-yellow)'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <StatCard label="Max Drawdown" value={`${result.max_drawdown_pct}%`}
              color="var(--talon-red)" />
            <StatCard label="Avg Win" value={formatMoney(result.avg_win)}
              color="var(--talon-green)" />
            <StatCard label="Avg Loss" value={formatMoney(result.avg_loss)}
              color="var(--talon-red)" />
          </div>

          {/* Equity Curve */}
          {result.equity_curve?.length > 0 && (
            <div className="stat-card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
                Equity Curve
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equity_curve}>
                    <defs>
                      <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={result.total_pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={result.total_pnl >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={['auto', 'auto']}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                    <Tooltip
                      contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                      formatter={(v) => [formatMoney(v), 'Equity']} />
                    <Area type="monotone" dataKey="equity"
                      stroke={result.total_pnl >= 0 ? '#10b981' : '#ef4444'} strokeWidth={2}
                      fill="url(#btGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Trade List */}
          {result.trades?.length > 0 && (
            <div className="stat-card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
                Trades ({result.trades.length})
              </h3>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: 'var(--talon-surface)' }}>
                    <tr style={{ color: 'var(--talon-muted)' }}>
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th className="text-left py-2 px-3 font-medium">Entry</th>
                      <th className="text-left py-2 px-3 font-medium">Exit</th>
                      <th className="text-right py-2 px-3 font-medium">Entry $</th>
                      <th className="text-right py-2 px-3 font-medium">Exit $</th>
                      <th className="text-right py-2 px-3 font-medium">P&L</th>
                      <th className="text-left py-2 px-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--talon-border)' }}>
                        <td className="py-2 px-3" style={{ color: 'var(--talon-muted)' }}>{i + 1}</td>
                        <td className="py-2 px-3 font-mono text-xs">{t.entry_time?.split('T')[0]}</td>
                        <td className="py-2 px-3 font-mono text-xs">{t.exit_time?.split('T')[0]}</td>
                        <td className="py-2 px-3 text-right font-mono">${t.entry_price?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono">${t.exit_price?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">
                          <PnlBadge value={t.pnl} />
                        </td>
                        <td className="py-2 px-3 text-xs" style={{ color: 'var(--talon-muted)' }}>
                          {t.exit_reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!result && !running && (
        <div className="stat-card flex flex-col items-center justify-center py-16">
          <FlaskConical size={48} style={{ color: 'var(--talon-border)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--talon-muted)' }}>
            Configure parameters above and run a backtest
          </p>
        </div>
      )}
    </div>
  )
}
