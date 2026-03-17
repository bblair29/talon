import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign, TrendingUp, ShieldAlert, Crosshair, Zap, RefreshCw, Loader2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import StatCard from '../components/StatCard'
import PnlBadge from '../components/PnlBadge'
import { postApi } from '../hooks/useApi'

function formatMoney(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatVolume(val) {
  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
  return `${(val / 1e3).toFixed(0)}K`
}

export default function Dashboard() {
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState(null)
  const [screener, setScreener] = useState(null)
  const [equityCurve, setEquityCurve] = useState([])
  const [loading, setLoading] = useState(true)
  const [killing, setKilling] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [acctRes, posRes] = await Promise.all([
        fetch('/api/account').then((r) => r.ok ? r.json() : null),
        fetch('/api/positions').then((r) => r.ok ? r.json() : null),
      ])

      if (acctRes) {
        setAccount(acctRes)
        // Append to equity curve
        setEquityCurve((prev) => {
          const now = new Date()
          const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
          const next = [...prev, { time, equity: acctRes.equity }]
          return next.slice(-100) // Keep last 100 points
        })
      }
      if (posRes) setPositions(posRes)
      setLastUpdate(new Date())
    } catch {
      // API not available — use fallback
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchScreener = useCallback(async () => {
    try {
      const data = await postApi('/scanner', { lookback: 60 })
      setScreener(data?.slice(0, 8) || null)
    } catch {
      // Scanner API not available
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchScreener()
    const interval = setInterval(fetchData, 15000) // Poll every 15s
    return () => clearInterval(interval)
  }, [fetchData, fetchScreener])

  const handleKillSwitch = async () => {
    if (!confirm('KILL SWITCH: Cancel all orders and close all positions?')) return
    setKilling(true)
    try {
      await postApi('/killswitch', {})
      await fetchData()
    } catch (err) {
      alert(`Kill switch error: ${err.message}`)
    } finally {
      setKilling(false)
    }
  }

  // Fallback data when API isn't connected
  const acct = account || { equity: 100000, cash: 100000, buying_power: 200000, day_trade_count: 0 }
  const pos = positions || []
  const apiConnected = account !== null

  const totalPnl = pos.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0)
  const totalPnlPct = acct.equity > 0 ? (totalPnl / acct.equity) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Dashboard</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
              Real-time account overview
            </p>
            {apiConnected ? (
              <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--talon-green)' }}>
                LIVE
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--talon-yellow)' }}>
                DEMO
              </span>
            )}
            {lastUpdate && (
              <span className="text-xs" style={{ color: 'var(--talon-muted)' }}>
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--talon-surface)', color: 'var(--talon-muted)', border: '1px solid var(--talon-border)' }}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--talon-red)' }}
            disabled={killing}
            onClick={handleKillSwitch}>
            {killing ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
            Kill Switch
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Equity" value={formatMoney(acct.equity)} icon={DollarSign}
          color="var(--talon-text)" sub={`Cash: ${formatMoney(acct.cash)}`} />
        <StatCard label="Unrealized P&L" value={formatMoney(totalPnl)}
          sub={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`}
          color={totalPnl >= 0 ? 'var(--talon-green)' : 'var(--talon-red)'}
          icon={TrendingUp} />
        <StatCard label="Open Positions" value={pos.length}
          sub="of 5 max" icon={Crosshair} color="var(--talon-accent)" />
        <StatCard label="Day Trades" value={acct.day_trade_count}
          sub="of 3 allowed (PDT)" icon={Zap}
          color={acct.day_trade_count >= 3 ? 'var(--talon-red)' : 'var(--talon-yellow)'} />
      </div>

      {/* Equity Curve + Reliable Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Intraday Equity
          </h3>
          <div className="h-64">
            {equityCurve.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                    formatter={(v) => [formatMoney(v), 'Equity']} />
                  <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2}
                    fill="url(#eqGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
                  Equity chart populates as data flows in...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top Reliable Movers */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
            Top Reliable Movers
          </h3>
          <div className="space-y-2">
            {(screener || []).map((s, i) => (
              <div key={s.symbol} className="flex items-center justify-between py-2 border-b"
                style={{ borderColor: 'var(--talon-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono w-5" style={{ color: 'var(--talon-muted)' }}>
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-sm font-bold" style={{ color: 'var(--talon-text)' }}>
                      {s.symbol}
                    </span>
                    <span className="text-xs ml-2" style={{ color: 'var(--talon-muted)' }}>
                      {formatMoney(s.price)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--talon-green)' }}>
                    {s.capture_rate_1pct}%
                  </span>
                  <span className="text-xs font-bold font-mono"
                    style={{ color: s.composite_score >= 60 ? 'var(--talon-green)' : 'var(--talon-yellow)' }}>
                    {s.composite_score}
                  </span>
                </div>
              </div>
            ))}
            {!screener && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--talon-muted)' }}>
                Connect API to see scanner results
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Open Positions Table */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
          Open Positions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--talon-muted)' }}>
                <th className="text-left py-2 px-3 font-medium">Symbol</th>
                <th className="text-right py-2 px-3 font-medium">Qty</th>
                <th className="text-right py-2 px-3 font-medium">Entry</th>
                <th className="text-right py-2 px-3 font-medium">Current</th>
                <th className="text-right py-2 px-3 font-medium">P&L</th>
                <th className="text-right py-2 px-3 font-medium">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => (
                <tr key={p.symbol} className="border-t" style={{ borderColor: 'var(--talon-border)' }}>
                  <td className="py-3 px-3 font-bold">{p.symbol}</td>
                  <td className="py-3 px-3 text-right">{p.qty}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatMoney(p.avg_entry)}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatMoney(p.current_price)}</td>
                  <td className="py-3 px-3 text-right">
                    <PnlBadge value={p.unrealized_pnl} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <PnlBadge value={p.unrealized_pnl_pct} />
                  </td>
                </tr>
              ))}
              {pos.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center" style={{ color: 'var(--talon-muted)' }}>
                    No open positions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
