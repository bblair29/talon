import { useState } from 'react'
import { History, Filter } from 'lucide-react'
import PnlBadge from '../components/PnlBadge'

const MOCK_TRADES = [
  { id: 1, symbol: 'NVDA', rule: 'momentum_pnl', side: 'BUY', qty: 27, entry_price: 182.50, exit_price: 185.20, pnl: 72.90, pnl_pct: 1.48, entry_time: '2026-03-16 10:15:00', exit_time: '2026-03-16 11:42:00', exit_reason: 'TAKE_PROFIT' },
  { id: 2, symbol: 'TSLA', rule: 'momentum_pnl', side: 'BUY', qty: 12, entry_price: 392.10, exit_price: 387.50, pnl: -55.20, pnl_pct: -1.17, entry_time: '2026-03-16 09:45:00', exit_time: '2026-03-16 11:45:00', exit_reason: 'MAX_HOLD' },
  { id: 3, symbol: 'AMD', rule: 'momentum_pnl', side: 'BUY', qty: 25, entry_price: 195.80, exit_price: 198.70, pnl: 72.50, pnl_pct: 1.48, entry_time: '2026-03-15 10:30:00', exit_time: '2026-03-15 11:15:00', exit_reason: 'TAKE_PROFIT' },
  { id: 4, symbol: 'COIN', rule: 'momentum_pnl', side: 'BUY', qty: 24, entry_price: 205.10, exit_price: 201.80, pnl: -79.20, pnl_pct: -1.61, entry_time: '2026-03-15 09:50:00', exit_time: '2026-03-15 10:20:00', exit_reason: 'STOP_LOSS' },
  { id: 5, symbol: 'PLTR', rule: 'momentum_pnl', side: 'BUY', qty: 32, entry_price: 151.20, exit_price: 155.10, pnl: 124.80, pnl_pct: 2.58, entry_time: '2026-03-14 10:05:00', exit_time: '2026-03-14 11:30:00', exit_reason: 'TAKE_PROFIT' },
]

function formatMoney(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function Trades() {
  const [filter, setFilter] = useState('')

  const filtered = filter
    ? MOCK_TRADES.filter((t) => t.symbol.includes(filter.toUpperCase()) || t.rule.includes(filter))
    : MOCK_TRADES

  const totalPnl = filtered.reduce((sum, t) => sum + t.pnl, 0)
  const wins = filtered.filter((t) => t.pnl > 0).length
  const losses = filtered.filter((t) => t.pnl < 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Trade History</h2>
          <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
            {filtered.length} trades | {wins}W / {losses}L | Net: {formatMoney(totalPnl)}
          </p>
        </div>
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
      </div>

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
              {filtered.map((t) => (
                <tr key={t.id} className="border-t hover:bg-white/[0.02] transition-colors"
                  style={{ borderColor: 'var(--talon-border)' }}>
                  <td className="py-3 px-3 font-bold">{t.symbol}</td>
                  <td className="py-3 px-3 text-xs" style={{ color: 'var(--talon-accent)' }}>{t.rule}</td>
                  <td className="py-3 px-3 text-right">{t.qty}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatMoney(t.entry_price)}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatMoney(t.exit_price)}</td>
                  <td className="py-3 px-3 text-right"><PnlBadge value={t.pnl} /></td>
                  <td className="py-3 px-3 text-right"><PnlBadge value={t.pnl_pct} /></td>
                  <td className="py-3 px-3">
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: t.exit_reason === 'TAKE_PROFIT' ? 'rgba(16,185,129,0.1)' :
                          t.exit_reason === 'STOP_LOSS' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        color: t.exit_reason === 'TAKE_PROFIT' ? 'var(--talon-green)' :
                          t.exit_reason === 'STOP_LOSS' ? 'var(--talon-red)' : 'var(--talon-yellow)',
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
    </div>
  )
}
