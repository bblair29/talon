import { app } from '@azure/functions';
import { spawn } from 'child_process';
import path from 'path';

app.http('backtest', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backtest',
  handler: async (request) => {
    try {
      const body = await request.json();
      const { symbol, rule, timeframe, lookback, equity } = body;

      // Run the Python backtester as a subprocess
      const result = await new Promise((resolve, reject) => {
        const pythonScript = `
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('ALPACA_API_KEY', '${process.env.ALPACA_API_KEY}')
os.environ.setdefault('ALPACA_SECRET_KEY', '${process.env.ALPACA_SECRET_KEY}')
os.environ.setdefault('TRADING_MODE', 'paper')

from trading_bot.core.broker import Broker
from trading_bot.core.rule_engine import RuleEngine
from trading_bot.backtester.engine import Backtester

broker = Broker()
engine = RuleEngine('trading_bot/config/rules')
engine.load_rules()

rule = None
for r in engine.rules:
    if r.name == '${rule}':
        rule = r
        break

if rule is None:
    print(json.dumps({"error": "Rule not found"}))
    sys.exit(0)

bt = Backtester(broker, initial_equity=${equity || 100000})
result = bt.run(rule, '${symbol}', lookback_days=${lookback || 30}, bar_timeframe='${timeframe || '5Min'}')
print(json.dumps(result.to_dict()))
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
              // Get the last JSON line from stdout
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
