import { app } from '@azure/functions';
import { spawn } from 'child_process';
import path from 'path';

app.http('scanner', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'scanner',
  handler: async (request) => {
    try {
      const body = await request.json();
      const lookback = body.lookback || 60;

      const result = await new Promise((resolve, reject) => {
        const pythonScript = `
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('ALPACA_API_KEY', '${process.env.ALPACA_API_KEY}')
os.environ.setdefault('ALPACA_SECRET_KEY', '${process.env.ALPACA_SECRET_KEY}')
os.environ.setdefault('TRADING_MODE', 'paper')

from trading_bot.core.broker import Broker
from trading_bot.core.opportunity_scanner import OpportunityScanner
import yaml

broker = Broker()
with open('trading_bot/config/settings.yaml') as f:
    settings = yaml.safe_load(f)

symbols = settings['screener']['universe']
scanner = OpportunityScanner(broker, lookback_days=${lookback})
results = scanner.scan(symbols)
print(json.dumps([r.to_dict() for r in results]))
`;

        const proc = spawn('python', ['-c', pythonScript], {
          cwd: path.resolve('..'),
          env: { ...process.env },
          timeout: 120000,
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
