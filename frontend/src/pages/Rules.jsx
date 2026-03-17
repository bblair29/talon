import { useState } from 'react'
import { BookOpen, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react'

const MOCK_RULES = [
  {
    name: 'scalper',
    type: 'ScalperRule',
    enabled: true,
    description: 'Bollinger Band bounce scalper — quick entries at support with tight exits',
    entry: { bb_period: 20, bb_std: 2.0, stoch_k: 14, stoch_d: 3, stoch_oversold: 25, adx_min: 20 },
    exit: { take_profit_pct: 1.0, stop_loss_pct: 0.5, trailing_stop_pct: 0.4, max_hold_minutes: 45 },
    sizing: { equity_pct: 5.0 },
    symbols: 'auto (from screener)',
    tag: '1% TARGET',
  },
  {
    name: 'vwap_reversion',
    type: 'VWAPMeanReversionRule',
    enabled: true,
    description: 'VWAP mean reversion — buy dips below VWAP, sell on snap-back',
    entry: { vwap_dip_pct: 0.3, rsi_period: 14, rsi_max: 40, volume_multiplier: 1.2 },
    exit: { take_profit_pct: 1.0, stop_loss_pct: 0.5, trailing_stop_pct: 0.3, max_hold_minutes: 60 },
    sizing: { equity_pct: 4.0 },
    symbols: 'auto (from screener)',
    tag: '1% TARGET',
  },
  {
    name: 'momentum_pnl',
    type: 'MomentumPnLRule',
    enabled: true,
    description: 'EMA crossover with volume confirmation',
    entry: { fast_ema: 9, slow_ema: 21, volume_avg_period: 20, volume_multiplier: 1.0 },
    exit: { take_profit_pct: 3.0, stop_loss_pct: 1.5, trailing_stop_pct: null, max_hold_minutes: 120 },
    sizing: { equity_pct: 5.0 },
    symbols: 'auto (from screener)',
  },
  {
    name: 'rsi_oversold_trailing',
    type: 'RSIPnLRule',
    enabled: false,
    description: 'RSI oversold bounce with trailing stop',
    entry: { rsi_period: 14, rsi_threshold: 32, ema_period: 50 },
    exit: { take_profit_pct: 5.0, stop_loss_pct: 2.0, trailing_stop_pct: 1.5, max_hold_minutes: 240 },
    sizing: { equity_pct: 4.0 },
    symbols: 'TSLA, NVDA, AMD, SPY',
  },
]

function ParamRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--talon-border)' }}>
      <span className="text-xs" style={{ color: 'var(--talon-muted)' }}>{label}</span>
      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--talon-text)' }}>
        {value === null ? '---' : String(value)}
      </span>
    </div>
  )
}

function RuleCard({ rule }) {
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(rule.enabled)

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setEnabled(!enabled)} className="transition-colors">
            {enabled
              ? <ToggleRight size={28} style={{ color: 'var(--talon-green)' }} />
              : <ToggleLeft size={28} style={{ color: 'var(--talon-muted)' }} />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold" style={{ color: 'var(--talon-text)' }}>
                {rule.name}
              </h3>
              {rule.tag && (
                <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                  style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--talon-accent)' }}>
                  {rule.tag}
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--talon-muted)' }}>
              {rule.type} — {rule.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-1 rounded-md font-medium"
            style={{
              background: enabled ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
              color: enabled ? 'var(--talon-green)' : 'var(--talon-muted)',
            }}>
            {enabled ? 'ACTIVE' : 'DISABLED'}
          </span>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-white/5">
            {expanded ? <ChevronUp size={16} style={{ color: 'var(--talon-muted)' }} /> :
              <ChevronDown size={16} style={{ color: 'var(--talon-muted)' }} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--talon-accent)' }}>Entry</h4>
            {Object.entries(rule.entry).map(([k, v]) => (
              <ParamRow key={k} label={k} value={v} />
            ))}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--talon-yellow)' }}>Exit</h4>
            {Object.entries(rule.exit).map(([k, v]) => (
              <ParamRow key={k} label={k} value={v} />
            ))}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--talon-green)' }}>Sizing & Symbols</h4>
            {Object.entries(rule.sizing).map(([k, v]) => (
              <ParamRow key={k} label={k} value={v} />
            ))}
            <ParamRow label="symbols" value={rule.symbols} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Rules() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Rules</h2>
        <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
          View and manage trading strategies
        </p>
      </div>

      <div className="space-y-4">
        {MOCK_RULES.map((r) => (
          <RuleCard key={r.name} rule={r} />
        ))}
      </div>

      <div className="stat-card flex items-center justify-center py-8 border-dashed"
        style={{ borderStyle: 'dashed' }}>
        <button className="text-sm font-medium flex items-center gap-2"
          style={{ color: 'var(--talon-accent)' }}>
          <BookOpen size={16} />
          Add New Rule
        </button>
      </div>
    </div>
  )
}
