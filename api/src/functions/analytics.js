import { app } from '@azure/functions';
import { spawn } from 'child_process';
import path from 'path';

app.http('analytics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'analytics',
  handler: async (request) => {
    try {
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '30');

      const result = await new Promise((resolve, reject) => {
        const pythonScript = `
import json, sys, os
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

trades_dir = Path('logs/trades')
cutoff = (datetime.now() - timedelta(days=${days})).strftime('%Y-%m-%d')

# Collect all trades
all_trades = []
if trades_dir.exists():
    for f in sorted(trades_dir.glob('trades_*.jsonl'), reverse=True):
        date_str = f.stem.replace('trades_', '')
        if date_str < cutoff:
            break
        with open(f) as fh:
            for line in fh:
                line = line.strip()
                if line:
                    all_trades.append(json.loads(line))

# Collect daily summaries
daily_summaries = []
if trades_dir.exists():
    for f in sorted(trades_dir.glob('summary_*.json'), reverse=True):
        date_str = f.stem.replace('summary_', '')
        if date_str < cutoff:
            break
        with open(f) as fh:
            daily_summaries.append(json.load(fh))

# Daily P&L
daily_pnl_map = defaultdict(float)
for t in all_trades:
    date = t.get('session_date', t.get('exit_time', '')[:10])
    daily_pnl_map[date] += t.get('pnl', 0)

daily_pnl = [{'date': d, 'pnl': round(v, 2)} for d, v in sorted(daily_pnl_map.items())]

# Symbol P&L
symbol_pnl_map = defaultdict(float)
for t in all_trades:
    symbol_pnl_map[t.get('symbol', 'UNKNOWN')] += t.get('pnl', 0)

symbol_pnl = sorted(
    [{'symbol': s, 'pnl': round(v, 2)} for s, v in symbol_pnl_map.items()],
    key=lambda x: x['pnl'], reverse=True
)

# Exit distribution
exit_counts = defaultdict(int)
for t in all_trades:
    exit_counts[t.get('exit_reason', 'UNKNOWN')] += 1

exit_colors = {
    'TAKE_PROFIT': 'var(--talon-green)',
    'STOP_LOSS': 'var(--talon-red)',
    'MAX_HOLD': 'var(--talon-yellow)',
    'TRAILING_STOP': 'var(--talon-accent)',
}
exit_dist = [{'name': k, 'value': v, 'color': exit_colors.get(k, 'var(--talon-muted)')}
             for k, v in exit_counts.items()]

# Rule performance
rule_stats = defaultdict(lambda: {'trades': 0, 'wins': 0, 'gross_profit': 0, 'gross_loss': 0, 'pnls': []})
for t in all_trades:
    rule = t.get('rule_name', 'unknown')
    pnl = t.get('pnl', 0)
    rule_stats[rule]['trades'] += 1
    rule_stats[rule]['pnls'].append(pnl)
    if pnl > 0:
        rule_stats[rule]['wins'] += 1
        rule_stats[rule]['gross_profit'] += pnl
    else:
        rule_stats[rule]['gross_loss'] += abs(pnl)

rule_perf = []
for rule, s in rule_stats.items():
    win_rate = (s['wins'] / s['trades'] * 100) if s['trades'] > 0 else 0
    pf = (s['gross_profit'] / s['gross_loss']) if s['gross_loss'] > 0 else 0
    avg = sum(s['pnls']) / len(s['pnls']) if s['pnls'] else 0
    # Sharpe approximation
    import math
    if len(s['pnls']) > 1:
        mean = sum(s['pnls']) / len(s['pnls'])
        variance = sum((x - mean) ** 2 for x in s['pnls']) / (len(s['pnls']) - 1)
        std = math.sqrt(variance) if variance > 0 else 1
        sharpe = round(mean / std, 2)
    else:
        sharpe = 0

    rule_perf.append({
        'rule': rule,
        'trades': s['trades'],
        'win_rate': round(win_rate, 1),
        'pnl': round(sum(s['pnls']), 2),
        'profit_factor': round(pf, 2),
        'sharpe': sharpe,
    })

# Equity history from daily summaries
equity_history = []
for ds in sorted(daily_summaries, key=lambda x: x.get('session_date', '')):
    eq = ds.get('start_equity', 0) + ds.get('realized_pnl', 0)
    equity_history.append({
        'date': ds.get('session_date', ''),
        'equity': round(eq, 2),
    })

# Top-level stats
total_pnl = sum(t.get('pnl', 0) for t in all_trades)
total_trades = len(all_trades)
wins = sum(1 for t in all_trades if t.get('pnl', 0) > 0)
win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
daily_vals = [v['pnl'] for v in daily_pnl] if daily_pnl else [0]
best_day = max(daily_vals)
worst_day = min(daily_vals)

analytics = {
    'total_pnl': round(total_pnl, 2),
    'total_trades': total_trades,
    'win_rate': round(win_rate, 1),
    'best_day': round(best_day, 2),
    'worst_day': round(worst_day, 2),
    'daily_pnl': daily_pnl,
    'symbol_pnl': symbol_pnl,
    'exit_distribution': exit_dist,
    'rule_performance': rule_perf,
    'equity_history': equity_history,
}

print(json.dumps(analytics))
`;

        const proc = spawn('python', ['-c', pythonScript], {
          cwd: path.resolve('..'),
          env: { ...process.env },
          timeout: 30000,
        });

        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.stderr.on('data', (d) => { stderr += d; });
        proc.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(stderr || `Process exited with code ${code}`));
          } else {
            try {
              const lines = stdout.trim().split('\n');
              const jsonLine = lines[lines.length - 1];
              resolve(JSON.parse(jsonLine));
            } catch (e) {
              reject(new Error(`Failed to parse output: ${stdout}`));
            }
          }
        });
      });

      return { jsonBody: result };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
