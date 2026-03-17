import { useState, useEffect } from 'react'
import { History, Filter, RefreshCw, Loader2 } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import PnlBadge from '../components/PnlBadge'

function formatMoney(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function Trades() {
  const [filter, setFilter] = useState('')
  const [days, setDays] = useState(30)
  const { data: trades, loading, error, refetch } = useApi(`/trades?days=${days}`)

  const list = trades || []
  const filtered = filter
    ? list.filter((t) => t.symbol?.includes(filter.toUpperCase()) || t.rule_name?.includes(filter))
    : list

  const totalPnl = filtered.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const wins = filtered.filter((t) => (t.pnl || 0) > 0).length
  const losses = filtered.filter((t) => (t.pnl || 0) < 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Trade History</h2>
          <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
            {filtered.length} trades | {wins}W / {losses}L | Net: {formatMoney(totalPnl)}
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
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--talon-muted)' }} />
            <input
              type="text"
              placeholder="Filter by symbol or rule..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm border w-64"
              style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}
            />
          </div>
          <button onClick={refetch} className="p-1.5 rounded-lg hover:bg-white/5"
            title="Refresh">
            <RefreshCw size={16} style={{ color: 'var(--talon-muted)' }} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="stat-card flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--talon-accent)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--talon-muted)' }}>Loading trades...</span>
        </div>
      )}

      {error && (
        <div className="stat-card text-center py-8">
          <p className="text-sm" style={{ color: 'var(--talon-yellow)' }}>
            No trade data available yet. Trades will appear here after TALON executes its first session.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="stat-card text-center py-8">
          <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
            {filter ? 'No trades match your filter.' : 'No trades recorded yet.'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="stat-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--talon-muted)' }}>
                  <th className="text-left py-2 px-3 font-medium">Symbol</th>
                  <th className="text-left py-2 px-3 font-medium">Rule</th>
                  <th className="text-right py-2 px-3 font-medium">Qty</th>
                  <th className="text-right py-2 px-3 font-medium">Entry</th>
                  <th className="text-right py-2 px-3 font-medium">Exit</th>
                  <th className="text-right py-2 px-3 font-medium">P&L</th>
                  <th className="text-right py-2 px-3 font-medium">P&L %</th>
                  <th className="text-left py-2 px-3 font-medium">Exit Reason</th>
                  <th className="text-left py-2 px-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, idx) => (
                  <tr key={t.id || idx} className="border-t hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: 'var(--talon-border)' }}>
                    <td className="py-3 px-3 font-bold">{t.symbol}</td>
                    <td className="py-3 px-3 text-xs" style={{ color: 'var(--talon-accent)' }}>{t.rule_name || t.rule}</td>
                    <td className="py-3 px-3 text-right">{t.qty}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatMoney(t.entry_price)}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatMoney(t.exit_price)}</td>
                    <td className="py-3 px-3 text-right"><PnlBadge value={t.pnl} /></td>
                    <td className="py-3 px-3 text-right"><PnlBadge value={(t.pnl_pct || 0) * 100} /></td>
                    <td className="py-3 px-3">
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: t.exit_reason === 'TAKE_PROFIT' ? 'rgba(16,185,129,0.1)' :
                            t.exit_reason === 'STOP_LOSS' ? 'rgba(239,68,68,0.1)' :
                            t.exit_reason === 'TRAILING_STOP' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                          color: t.exit_reason === 'TAKE_PROFIT' ? 'var(--talon-green)' :
                            t.exit_reason === 'STOP_LOSS' ? 'var(--talon-red)' :
                            t.exit_reason === 'TRAILING_STOP' ? 'var(--talon-accent)' : 'var(--talon-yellow)',
                        }}>
                        {t.exit_reason}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs font-mono" style={{ color: 'var(--talon-muted)' }}>
                      {t.entry_time}
                    </td>
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
