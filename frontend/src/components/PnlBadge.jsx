import { TrendingUp, TrendingDown } from 'lucide-react'

export default function PnlBadge({ value, showIcon = true }) {
  const isPositive = value >= 0
  const color = isPositive ? 'var(--talon-green)' : 'var(--talon-red)'
  const bg = isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'
  const Icon = isPositive ? TrendingUp : TrendingDown
  const formatted = `${isPositive ? '+' : ''}${typeof value === 'number' ? value.toFixed(2) : value}`

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ color, background: bg }}>
      {showIcon && <Icon size={12} />}
      {formatted}
    </span>
  )
}
