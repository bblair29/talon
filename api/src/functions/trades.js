import { app } from '@azure/functions';
import { spawn } from 'child_process';
import path from 'path';

app.http('trades', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'trades',
  handler: async (request) => {
    try {
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '30');

      const result = await new Promise((resolve, reject) => {
        const pythonScript = `
import json, sys, os, glob
from datetime import datetime, timedelta
from pathlib import Path

trades_dir = Path('logs/trades')
all_trades = []

if trades_dir.exists():
    cutoff = (datetime.now() - timedelta(days=${days})).strftime('%Y-%m-%d')
    for f in sorted(trades_dir.glob('trades_*.jsonl'), reverse=True):
        date_str = f.stem.replace('trades_', '')
        if date_str < cutoff:
            break
        with open(f) as fh:
            for line in fh:
                line = line.strip()
                if line:
                    all_trades.append(json.loads(line))

# Also check for daily summaries to get trades embedded there
for f in sorted(trades_dir.glob('summary_*.json'), reverse=True):
    date_str = f.stem.replace('summary_', '')
    if date_str < cutoff:
        break
    with open(f) as fh:
        summary = json.load(fh)
        for t in summary.get('trades', []):
            # Avoid duplicates by checking if trade already exists
            key = (t.get('symbol',''), t.get('entry_time',''), t.get('exit_time',''))
            existing = set((tr.get('symbol',''), tr.get('entry_time',''), tr.get('exit_time','')) for tr in all_trades)
            if key not in existing:
                all_trades.append(t)

# Sort by exit_time descending
all_trades.sort(key=lambda t: t.get('exit_time', ''), reverse=True)

# Add sequential IDs
for i, t in enumerate(all_trades):
    t['id'] = i + 1

print(json.dumps(all_trades))
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
