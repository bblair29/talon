import { useState } from 'react'
import { BookOpen, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'
import { useApi, postApi } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'

function ParamRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--talon-border)' }}>
      <span className="text-xs" style={{ color: 'var(--talon-muted)' }}>{label}</span>
      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--talon-text)' }}>
        {value === null || value === undefined ? '---' : String(value)}
      </span>
    </div>
  )
}

function RuleCard({ rule, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    try {
      const updated = { ...rule, enabled: !rule.enabled }
      delete updated.filename
      const res = await fetch(`/api/rules/${rule.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (res.ok) {
        onToggle()
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    } finally {
      setToggling(false)
    }
  }

  const entry = rule.entry || {}
  const exit = rule.exit || {}
  const sizing = rule.sizing || {}
  const symbols = rule.symbols === 'auto' ? 'auto (from screener)' :
    Array.isArray(rule.symbols) ? rule.symbols.join(', ') : String(rule.symbols || 'auto')

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleToggle} className="transition-colors" disabled={toggling}>
            {toggling ? (
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--talon-muted)' }} />
            ) : rule.enabled
              ? <ToggleRight size={28} style={{ color: 'var(--talon-green)' }} />
              : <ToggleLeft size={28} style={{ color: 'var(--talon-muted)' }} />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold" style={{ color: 'var(--talon-text)' }}>
                {rule.name}
              </h3>
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--talon-accent)' }}>
                {rule.type}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--talon-muted)' }}>
              {rule.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-1 rounded-md font-medium"
            style={{
              background: rule.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
              color: rule.enabled ? 'var(--talon-green)' : 'var(--talon-muted)',
            }}>
            {rule.enabled ? 'ACTIVE' : 'DISABLED'}
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
            {Object.entries(entry).map(([k, v]) => (
              <ParamRow key={k} label={k} value={v} />
            ))}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--talon-yellow)' }}>Exit</h4>
            {Object.entries(exit).map(([k, v]) => (
              <ParamRow key={k} label={k} value={v} />
            ))}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--talon-green)' }}>Sizing & Symbols</h4>
            {Object.entries(sizing).map(([k, v]) => (
              <ParamRow key={k} label={k} value={v} />
            ))}
            <ParamRow label="symbols" value={symbols} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Rules() {
  const { data: rules, loading, error, refetch } = useApi('/rules')
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Rules</h2>
        </div>
        <div className="stat-card flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--talon-accent)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--talon-muted)' }}>Loading rules...</span>
        </div>
      </div>
    )
  }

  const ruleList = rules || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Rules</h2>
          <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
            {ruleList.length} rules configured | {ruleList.filter(r => r.enabled).length} active
          </p>
        </div>
        <button onClick={refetch} className="p-1.5 rounded-lg hover:bg-white/5"
          title="Refresh">
          <RefreshCw size={16} style={{ color: 'var(--talon-muted)' }} />
        </button>
      </div>

      {error && (
        <div className="stat-card text-center py-8">
          <p className="text-sm" style={{ color: 'var(--talon-yellow)' }}>
            Could not load rules from server. Check that the API is running.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {ruleList.map((r) => (
          <RuleCard key={r.name} rule={r} onToggle={refetch} />
        ))}
      </div>

      <div className="stat-card flex items-center justify-center py-8 border-dashed"
        style={{ borderStyle: 'dashed' }}>
        <button onClick={() => navigate('/composer')}
          className="text-sm font-medium flex items-center gap-2"
          style={{ color: 'var(--talon-accent)' }}>
          <BookOpen size={16} />
          Add New Rule
        </button>
      </div>
    </div>
  )
}
