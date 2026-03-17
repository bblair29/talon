export default function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--talon-muted)' }}>
          {label}
        </span>
        {Icon && <Icon size={16} style={{ color: 'var(--talon-muted)' }} />}
      </div>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--talon-text)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: 'var(--talon-muted)' }}>{sub}</p>
      )}
    </div>
  )
}
