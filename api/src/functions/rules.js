import { app } from '@azure/functions';
import { spawn } from 'child_process';
import path from 'path';

app.http('rules-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'rules',
  handler: async () => {
    try {
      const result = await runPython(`
import json, yaml, os
from pathlib import Path

rules_dir = Path('trading_bot/config/rules')
rules = []

if rules_dir.exists():
    for f in sorted(rules_dir.glob('*.yaml')):
        with open(f) as fh:
            r = yaml.safe_load(fh)
            r['filename'] = f.name
            rules.append(r)

print(json.dumps(rules))
`);
      return { jsonBody: result };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

app.http('rules-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'rules/{name}',
  handler: async (request) => {
    try {
      const ruleName = request.params.name;
      const body = await request.json();

      // Validate rule name (alphanumeric + underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(ruleName)) {
        return { status: 400, jsonBody: { error: 'Invalid rule name' } };
      }

      const yamlContent = JSON.stringify(body);

      const result = await runPython(`
import json, yaml, os
from pathlib import Path

rules_dir = Path('trading_bot/config/rules')
rule_name = ${JSON.stringify(ruleName)}
rule_data = json.loads(${JSON.stringify(yamlContent)})

# Remove internal fields
rule_data.pop('filename', None)

rule_path = rules_dir / f'{rule_name}.yaml'
if not rule_path.exists():
    print(json.dumps({'error': 'Rule not found'}))
else:
    with open(rule_path, 'w') as f:
        yaml.dump(rule_data, f, default_flow_style=False, sort_keys=False)
    print(json.dumps({'success': True, 'name': rule_name}))
`);

      if (result.error) {
        return { status: 404, jsonBody: result };
      }
      return { jsonBody: result };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

app.http('rules-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'rules',
  handler: async (request) => {
    try {
      const body = await request.json();
      const ruleName = body.name;

      if (!ruleName || !/^[a-zA-Z0-9_]+$/.test(ruleName)) {
        return { status: 400, jsonBody: { error: 'Invalid rule name. Use only letters, numbers, and underscores.' } };
      }

      const yamlContent = JSON.stringify(body);

      const result = await runPython(`
import json, yaml, os
from pathlib import Path

rules_dir = Path('trading_bot/config/rules')
rule_data = json.loads(${JSON.stringify(yamlContent)})

rule_name = rule_data.get('name', '')
rule_path = rules_dir / f'{rule_name}.yaml'

if rule_path.exists():
    print(json.dumps({'error': f'Rule {rule_name} already exists'}))
else:
    # Remove internal fields
    rule_data.pop('filename', None)

    with open(rule_path, 'w') as f:
        yaml.dump(rule_data, f, default_flow_style=False, sort_keys=False)
    print(json.dumps({'success': True, 'name': rule_name}))
`);

      if (result.error) {
        return { status: 409, jsonBody: result };
      }
      return { status: 201, jsonBody: result };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

app.http('rules-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'rules/{name}',
  handler: async (request) => {
    try {
      const ruleName = request.params.name;

      if (!/^[a-zA-Z0-9_]+$/.test(ruleName)) {
        return { status: 400, jsonBody: { error: 'Invalid rule name' } };
      }

      const result = await runPython(`
import json, os
from pathlib import Path

rules_dir = Path('trading_bot/config/rules')
rule_name = ${JSON.stringify(ruleName)}
rule_path = rules_dir / f'{rule_name}.yaml'

if not rule_path.exists():
    print(json.dumps({'error': 'Rule not found'}))
else:
    os.remove(rule_path)
    print(json.dumps({'success': True, 'name': rule_name}))
`);

      if (result.error) {
        return { status: 404, jsonBody: result };
      }
      return { jsonBody: result };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});

function runPython(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', ['-c', script], {
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
}
