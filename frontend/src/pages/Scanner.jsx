import { useState } from 'react'
import {
  Radar, Play, Loader2, ShieldCheck, AlertTriangle, TrendingUp, Zap,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as ReRadar,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import StatCard from '../components/StatCard'
import { postApi } from '../hooks/useApi'

function formatMoney(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatVolume(val) {
  if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`
  return val
}

function scoreColor(score) {
  if (score >= 65) return 'var(--talon-green)'
  if (score >= 50) return 'var(--talon-yellow)'
  return 'var(--talon-red)'
}

function ScoreBar({ value, max = 100, color }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="w-full h-2 rounded-full" style={{ background: 'var(--talon-border)' }}>
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color || scoreColor(value) }} />
    </div>
  )
}

function RadarProfile({ data }) {
  const radarData = [
    { metric: 'Capture Rate', value: data.capture_rate_1pct },
    { metric: 'Consistency', value: data.range_consistency },
    { metric: 'Range', value: Math.min(data.avg_daily_range_pct * 15, 100) },
    { metric: 'Volume', value: data.volume_score },
    { metric: 'Safety', value: Math.max(0, 100 - data.gap_down_rate * 10) },
    { metric: 'Streaks', value: Math.min(data.win_streak_avg * 20, 100) },
  ]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData}>
        <PolarGrid stroke="#1e2d3d" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <ReRadar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export default function Scanner() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState(null)
  const [lookback, setLookback] = useState(60)

  const runScan = async () => {
    setRunning(true)
    setResults(null)
    setSelected(null)
    try {
      const data = await postApi('/scanner', { lookback })
      setResults(data)
      if (data.length > 0) setSelected(data[0])
    } catch (err) {
      alert(`Scan failed: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  const topSymbols = results?.slice(0, 10) || []
  const captureData = topSymbols.map((r) => ({
    symbol: r.symbol,
    '1% Capture': r.capture_rate_1pct,
    '0.5% Capture': r.capture_rate_half_pct,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--talon-text)' }}>Reliable Movers</h2>
          <p className="text-sm" style={{ color: 'var(--talon-muted)' }}>
            Find stocks where 1%/day captures are consistent and safe
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={lookback} onChange={(e) => setLookback(+e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border"
            style={{ background: 'var(--talon-surface-2)', borderColor: 'var(--talon-border)', color: 'var(--talon-text)' }}>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button onClick={runScan} disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--talon-accent)' }}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
            {running ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Top 3 Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {results.slice(0, 3).map((r, i) => (
              <div key={r.symbol} className="stat-card cursor-pointer transition-all"
                onClick={() => setSelected(r)}
                style={{
                  borderColor: selected?.symbol === r.symbol ? 'var(--talon-accent)' : 'var(--talon-border)',
                  borderWidth: selected?.symbol === r.symbol ? 2 : 1,
                }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--talon-accent)' }}>
                      #{i + 1}
                    </span>
                    <span className="text-lg font-bold">{r.symbol}</span>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: scoreColor(r.composite_score) }}>
                    {r.composite_score}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--talon-muted)' }}>1% Capture Rate</span>
                    <span className="font-bold" style={{ color: 'var(--talon-green)' }}>{r.capture_rate_1pct}%</span>
                  </div>
                  <ScoreBar value={r.capture_rate_1pct} />
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--talon-muted)' }}>Consistency</span>
                    <span className="font-bold">{r.range_consistency}</span>
                  </div>
                  <ScoreBar value={r.range_consistency} />
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--talon-muted)' }}>Gap Risk</span>
                    <span className="font-bold" style={{
                      color: r.gap_down_rate === 0 ? 'var(--talon-green)' :
                        r.gap_down_rate < 5 ? 'var(--talon-yellow)' : 'var(--talon-red)'
                    }}>
                      {r.gap_down_rate}%
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 flex justify-between text-xs border-t" style={{ borderColor: 'var(--talon-border)' }}>
                  <span style={{ color: 'var(--talon-muted)' }}>{formatMoney(r.price)}</span>
                  <span style={{ color: 'var(--talon-muted)' }}>Vol: {formatVolume(r.avg_volume)}</span>
                  <span style={{ color: 'var(--talon-muted)' }}>Range: {r.avg_daily_range_pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Capture Rate Chart */}
            <div className="stat-card lg:col-span-2">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
                Daily Capture Rates — How often can you grab 0.5% or 1%?
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={captureData}>
                    <XAxis dataKey="symbol" tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 600 }}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false} tickLine={false} domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0' }}
                      formatter={(v) => [`${v}%`]} />
                    <Bar dataKey="0.5% Capture" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.4} />
                    <Bar dataKey="1% Capture" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar for selected */}
            {selected && (
              <div className="stat-card">
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--talon-muted)' }}>
                  {selected.symbol} Profile
                </h3>
                <div className="h-64">
                  <RadarProfile data={selected} />
                </div>
              </div>
            )}
          </div>

          {/* Selected Detail Stats */}
          {selected && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard label="Avg Range" value={`${selected.avg_daily_range_pct}%`}
                sub="daily high-low" color="var(--talon-accent)" />
              <StatCard label="Avg Up from Open" value={`+${selected.avg_intraday_high_from_open}%`}
                sub="open to daily high" color="var(--talon-green)" />
              <StatCard label="Avg Down from Open" value={`-${selected.avg_intraday_low_from_open}%`}
                sub="open to daily low" color="var(--talon-red)" />
              <StatCard label="Win Streak" value={`${selected.win_streak_avg} days`}
                sub="avg consecutive 1%+ days" color="var(--talon-yellow)" />
              <StatCard label="Gap Down Risk" value={`${selected.gap_down_rate}%`}
                sub="days with >3% gap down"
                icon={selected.gap_down_rate === 0 ? ShieldCheck : AlertTriangle}
                color={selected.gap_down_rate === 0 ? 'var(--talon-green)' : 'var(--talon-red)'} />
              <StatCard label="0.5% Capture" value={`${selected.capture_rate_half_pct}%`}
                sub="safer target" color="var(--talon-accent)" />
            </div>
          )}

          {/* Full Ranking Table */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--talon-muted)' }}>
              Full Rankings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--talon-muted)' }}>
                    <th className="text-left py-2 px-3 font-medium">Rank</th>
                    <th className="text-left py-2 px-3 font-medium">Symbol</th>
                    <th className="text-right py-2 px-3 font-medium">Score</th>
                    <th className="text-right py-2 px-3 font-medium">Price</th>
                    <th className="text-right py-2 px-3 font-medium">Range %</th>
                    <th className="text-right py-2 px-3 font-medium">1% Cap</th>
                    <th className="text-right py-2 px-3 font-medium">0.5% Cap</th>
                    <th className="text-right py-2 px-3 font-medium">Consist.</th>
                    <th className="text-right py-2 px-3 font-medium">Gap Risk</th>
                    <th className="text-right py-2 px-3 font-medium">Avg Vol</th>
                    <th className="text-right py-2 px-3 font-medium">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.symbol}
                      className="border-t cursor-pointer hover:bg-white/[0.02] transition-colors"
                      style={{
                        borderColor: 'var(--talon-border)',
                        background: selected?.symbol === r.symbol ? 'rgba(59,130,246,0.05)' : undefined,
                      }}
                      onClick={() => setSelected(r)}>
                      <td className="py-3 px-3 font-mono text-xs" style={{ color: 'var(--talon-muted)' }}>
                        {i + 1}
                      </td>
                      <td className="py-3 px-3 font-bold">{r.symbol}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold font-mono" style={{ color: scoreColor(r.composite_score) }}>
                          {r.composite_score}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">{formatMoney(r.price)}</td>
                      <td className="py-3 px-3 text-right">{r.avg_daily_range_pct}%</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold" style={{
                          color: r.capture_rate_1pct >= 60 ? 'var(--talon-green)' :
                            r.capture_rate_1pct >= 40 ? 'var(--talon-yellow)' : 'var(--talon-red)'
                        }}>
                          {r.capture_rate_1pct}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right" style={{ color: 'var(--talon-accent)' }}>
                        {r.capture_rate_half_pct}%
                      </td>
                      <td className="py-3 px-3 text-right">{r.range_consistency}</td>
                      <td className="py-3 px-3 text-right">
                        <span style={{
                          color: r.gap_down_rate === 0 ? 'var(--talon-green)' :
                            r.gap_down_rate < 5 ? 'var(--talon-yellow)' : 'var(--talon-red)'
                        }}>
                          {r.gap_down_rate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs">{formatVolume(r.avg_volume)}</td>
                      <td className="py-3 px-3 text-right">{r.win_streak_avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!results && !running && (
        <div className="stat-card flex flex-col items-center justify-center py-16">
          <Radar size={48} style={{ color: 'var(--talon-border)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--talon-muted)' }}>
            Run a scan to find the best stocks for consistent 1% daily captures
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--talon-muted)' }}>
            Scores based on capture rate, consistency, volume, and gap-down safety
          </p>
        </div>
      )}
    </div>
  )
}
