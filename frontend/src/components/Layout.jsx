import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Radar,
  FlaskConical,
  BookOpen,
  Wand2,
  History,
  BarChart3,
  Crosshair,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scanner', icon: Radar, label: 'Reliable Movers' },
  { to: '/backtester', icon: FlaskConical, label: 'Backtester' },
  { to: '/rules', icon: BookOpen, label: 'Rules' },
  { to: '/composer', icon: Wand2, label: 'Rule Composer' },
  { to: '/trades', icon: History, label: 'Trades' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ background: 'var(--talon-surface)', borderColor: 'var(--talon-border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b"
          style={{ borderColor: 'var(--talon-border)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--talon-accent)' }}>
            <Crosshair size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide" style={{ color: 'var(--talon-text)' }}>
              TALON
            </h1>
            <p className="text-xs" style={{ color: 'var(--talon-muted)' }}>Trading Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'hover:text-white'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--talon-accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--talon-muted)',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--talon-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full pulse-green" style={{ background: 'var(--talon-green)' }} />
            <span className="text-xs" style={{ color: 'var(--talon-muted)' }}>Paper Trading</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--talon-bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
