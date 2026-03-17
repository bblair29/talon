import { useState } from 'react'
import {
  Wand2, Copy, Download, Plus, Trash2, ChevronRight,
} from 'lucide-react'

const RULE_TYPES = [
  {
    value: 'ScalperRule',
    label: 'Scalper (BB Bounce)',
    description: 'Bollinger Band bounce with stochastic confirmation',
    defaults: {
      entry: { bb_period: 20, bb_std: 2.0, stoch_k: 14, stoch_d: 3, stoch_oversold: 25, adx_min: 20 },
      exit: { take_profit_pct: 1.0, stop_loss_pct: 0.5, trailing_stop_pct: 0.4, max_hold_minutes: 45 },
      sizing: { equity_pct: 5.0 },
    },
  },
  {
    value: 'VWAPMeanReversionRule',
    label: 'VWAP Reversion',
    description: 'Buy dips below VWAP, sell on snap-back',
    defaults: {
      entry: { vwap_dip_pct: 0.3, rsi_period: 14, rsi_max: 40, volume_multiplier: 1.2 },
      exit: { take_profit_pct: 1.0, stop_loss_pct: 0.5, trailing_stop_pct: 0.3, max_hold_minutes: 60 },
      sizing: { equity_pct: 4.0 },
    },
  },
  {
    value: 'MomentumPnLRule',
    label: 'Momentum (EMA Crossover)',
    description: 'EMA crossover with volume confirmation',
    defaults: {
      entry: { fast_ema: 9, slow_ema: 21, volume_avg_period: 20, volume_multiplier: 1.0 },
      exit: { take_profit_pct: 3.0, stop_loss_pct: 1.5, trailing_stop_pct: null, max_hold_minutes: 120 },
      sizing: { equity_pct: 5.0 },
    },
  },
  {
    value: 'RSIPnLRule',
    label: 'RSI Oversold',
    description: 'RSI oversold bounce with EMA trend filter',
    defaults: {
      entry: { rsi_period: 14, rsi_threshold: 32, ema_period: 50 },
      exit: { take_profit_pct: 5.0, stop_loss_pct: 2.0, trailing_stop_pct: 1.5, max_hold_minutes: 240 },
      sizing: { equity_pct: 4.0 },
    },
  },
]

function ParamInput({ label, value, onChange, type = 'number' }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <label className="text-xs" style={{ color: 'var(--talon-muted)' }}>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="w-24 px-2 py-1 rounded text-xs text-right border"
        style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}
      />
    </div>
  )
}

export default function RuleComposer() {
  const [name, setName] = useState('my_custom_rule')
  const [description, setDescription] = useState('')
  const [selectedType, setSelectedType] = useState(RULE_TYPES[0].value)
  const [enabled, setEnabled] = useState(true)
  const [symbolMode, setSymbolMode] = useState('auto')
  const [manualSymbols, setManualSymbols] = useState('TSLA, NVDA, AMD')

  const typeConfig = RULE_TYPES.find((t) => t.value === selectedType)
  const [entry, setEntry] = useState({ ...typeConfig.defaults.entry })
  const [exit, setExit] = useState({ ...typeConfig.defaults.exit })
  const [sizing, setSizing] = useState({ ...typeConfig.defaults.sizing })

  const handleTypeChange = (val) => {
    setSelectedType(val)
    const cfg = RULE_TYPES.find((t) => t.value === val)
    setEntry({ ...cfg.defaults.entry })
    setExit({ ...cfg.defaults.exit })
    setSizing({ ...cfg.defaults.sizing })
  }

  const generateYaml = () => {
    const lines = [
      `name: ${name}`,
      `type: ${selectedType}`,
      `enabled: ${enabled}`,
      `description: "${description || typeConfig.description}"`,
      '',
      'entry:',
      ...Object.entries(entry).map(([k, v]) => `  ${k}: ${v === null ? 'null' : v}`),
      '',
      'exit:',
      ...Object.entries(exit).map(([k, v]) => `  ${k}: ${v === null ? 'null' : v}`),
      '',
      'sizing:',
      ...Object.entries(sizing).map(([k, v]) => `  ${k}: ${v}`),
      '',
      symbolMode === 'auto' ? 'symbols: auto' : `symbols:\n${manualSymbols.split(',').map((s) => `  - ${s.trim()}`).join('\n')}`,
    ]
    return lines.join('\n')
  }

  const yaml = generateYaml()

  const copyToClipboard = () => {
    navigator.clipboard.writeText(yaml)
  }

  const downloadFile = () => {
    const blob = new Blob([yaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Rule Composer</h2>
        <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
          Build trading rules visually — generates YAML ready to deploy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config Panel */}
        <div className="space-y-4">
          {/* Basics */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--talon-accent)' }}>Basics</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--talon-muted)' }}>Rule Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--talon-muted)' }}>Strategy Type</label>
                <select value={selectedType} onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}>
                  {RULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: 'var(--talon-muted)' }}>{typeConfig.description}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--talon-muted)' }}>Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={typeConfig.description}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium" style={{ color: 'var(--talon-muted)' }}>Enabled</label>
                <button onClick={() => setEnabled(!enabled)}
                  className="text-xs px-3 py-1 rounded-md font-bold"
                  style={{
                    background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                    color: enabled ? 'var(--talon-green)' : 'var(--talon-muted)',
                  }}>
                  {enabled ? 'YES' : 'NO'}
                </button>
              </div>
            </div>
          </div>

          {/* Entry Params */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--talon-green)' }}>Entry Conditions</h3>
            {Object.entries(entry).map(([k, v]) => (
              <ParamInput key={k} label={k} value={v}
                onChange={(val) => setEntry({ ...entry, [k]: val })} />
            ))}
          </div>

          {/* Exit Params */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--talon-red)' }}>Exit Conditions</h3>
            {Object.entries(exit).map(([k, v]) => (
              <ParamInput key={k} label={k} value={v}
                onChange={(val) => setExit({ ...exit, [k]: val })} />
            ))}
          </div>

          {/* Sizing & Symbols */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--talon-yellow)' }}>Sizing & Symbols</h3>
            {Object.entries(sizing).map(([k, v]) => (
              <ParamInput key={k} label={k} value={v}
                onChange={(val) => setSizing({ ...sizing, [k]: val })} />
            ))}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--talon-border)' }}>
              <div className="flex gap-3 mb-2">
                <button onClick={() => setSymbolMode('auto')}
                  className="text-xs px-3 py-1 rounded-md font-bold"
                  style={{
                    background: symbolMode === 'auto' ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: symbolMode === 'auto' ? 'var(--talon-accent)' : 'var(--talon-muted)',
                  }}>
                  Auto (Screener)
                </button>
                <button onClick={() => setSymbolMode('manual')}
                  className="text-xs px-3 py-1 rounded-md font-bold"
                  style={{
                    background: symbolMode === 'manual' ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: symbolMode === 'manual' ? 'var(--talon-accent)' : 'var(--talon-muted)',
                  }}>
                  Manual
                </button>
              </div>
              {symbolMode === 'manual' && (
                <input type="text" value={manualSymbols} onChange={(e) => setManualSymbols(e.target.value)}
                  placeholder="TSLA, NVDA, AMD"
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }} />
              )}
            </div>
          </div>
        </div>

        {/* YAML Preview */}
        <div className="space-y-4">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--talon-accent)' }}>Generated YAML</h3>
              <div className="flex gap-2">
                <button onClick={copyToClipboard}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--talon-border)', color: 'var(--talon-muted)' }}>
                  <Copy size={12} /> Copy
                </button>
                <button onClick={downloadFile}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: 'var(--talon-accent)' }}>
                  <Download size={12} /> Download
                </button>
              </div>
            </div>
            <pre className="text-xs font-mono p-4 rounded-lg overflow-x-auto whitespace-pre"
              style={{ background: 'var(--talon-bg)', color: 'var(--talon-text)', border: '1px solid var(--talon-border)' }}>
              {yaml}
            </pre>
          </div>

          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--talon-muted)' }}>How to Deploy</h3>
            <ol className="text-xs space-y-2" style={{ color: 'var(--talon-muted)' }}>
              <li className="flex gap-2">
                <span className="font-bold" style={{ color: 'var(--talon-accent)' }}>1.</span>
                Download or copy the YAML above
              </li>
              <li className="flex gap-2">
                <span className="font-bold" style={{ color: 'var(--talon-accent)' }}>2.</span>
                Save as <code className="px-1 rounded" style={{ background: 'var(--talon-surface-2)' }}>trading_bot/config/rules/{name}.yaml</code>
              </li>
              <li className="flex gap-2">
                <span className="font-bold" style={{ color: 'var(--talon-accent)' }}>3.</span>
                TALON auto-discovers it on next startup
              </li>
              <li className="flex gap-2">
                <span className="font-bold" style={{ color: 'var(--talon-accent)' }}>4.</span>
                Backtest it first on the Backtester page before enabling live
              </li>
            </ol>
          </div>

          {/* Quick presets */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--talon-muted)' }}>Quick Presets</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => {
                handleTypeChange('ScalperRule')
                setName('aggressive_scalper')
                setDescription('Aggressive 1% scalper with tight stops')
                setExit({ take_profit_pct: 0.8, stop_loss_pct: 0.3, trailing_stop_pct: 0.25, max_hold_minutes: 30 })
              }} className="text-left p-3 rounded-lg border transition-colors hover:border-blue-500/50"
                style={{ borderColor: 'var(--talon-border)', background: 'var(--talon-surface-2)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--talon-text)' }}>Aggressive Scalper</p>
                <p className="text-xs" style={{ color: 'var(--talon-muted)' }}>0.8% TP, 0.3% SL, 30min max</p>
              </button>
              <button onClick={() => {
                handleTypeChange('VWAPMeanReversionRule')
                setName('conservative_vwap')
                setDescription('Conservative VWAP reversion with wide stop')
                setEntry({ vwap_dip_pct: 0.5, rsi_period: 14, rsi_max: 35, volume_multiplier: 1.5 })
                setExit({ take_profit_pct: 0.7, stop_loss_pct: 0.7, trailing_stop_pct: 0.3, max_hold_minutes: 90 })
              }} className="text-left p-3 rounded-lg border transition-colors hover:border-blue-500/50"
                style={{ borderColor: 'var(--talon-border)', background: 'var(--talon-surface-2)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--talon-text)' }}>Conservative VWAP</p>
                <p className="text-xs" style={{ color: 'var(--talon-muted)' }}>0.7% TP, 0.7% SL, 90min max</p>
              </button>
              <button onClick={() => {
                handleTypeChange('MomentumPnLRule')
                setName('swing_momentum')
                setDescription('Wider momentum play for bigger moves')
                setEntry({ fast_ema: 5, slow_ema: 13, volume_avg_period: 20, volume_multiplier: 1.5 })
                setExit({ take_profit_pct: 2.0, stop_loss_pct: 1.0, trailing_stop_pct: 0.8, max_hold_minutes: 180 })
              }} className="text-left p-3 rounded-lg border transition-colors hover:border-blue-500/50"
                style={{ borderColor: 'var(--talon-border)', background: 'var(--talon-surface-2)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--talon-text)' }}>Swing Momentum</p>
                <p className="text-xs" style={{ color: 'var(--talon-muted)' }}>2% TP, 1% SL, fast EMA</p>
              </button>
              <button onClick={() => {
                handleTypeChange('RSIPnLRule')
                setName('deep_dip_buyer')
                setDescription('Buy extreme RSI dips in uptrends')
                setEntry({ rsi_period: 14, rsi_threshold: 25, ema_period: 20 })
                setExit({ take_profit_pct: 1.5, stop_loss_pct: 1.0, trailing_stop_pct: 0.5, max_hold_minutes: 120 })
              }} className="text-left p-3 rounded-lg border transition-colors hover:border-blue-500/50"
                style={{ borderColor: 'var(--talon-border)', background: 'var(--talon-surface-2)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--talon-text)' }}>Deep Dip Buyer</p>
                <p className="text-xs" style={{ color: 'var(--talon-muted)' }}>RSI&lt;25, 1.5% TP, trailing</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
