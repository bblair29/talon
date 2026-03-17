import { app } from '@azure/functions';
import { query, queryOne } from '../lib/snowflake.js';

app.http('rules-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'rules',
  handler: async () => {
    try {
      const rows = await query(
        `SELECT id, name, type, enabled, description, config,
                created_at, updated_at
         FROM RULES
         ORDER BY created_at ASC`
      );

      const rules = rows.map((r) => {
        const config = typeof r.CONFIG === 'string' ? JSON.parse(r.CONFIG) : r.CONFIG;
        return {
          id: r.ID,
          name: r.NAME,
          type: r.TYPE,
          enabled: r.ENABLED,
          description: r.DESCRIPTION,
          entry: config?.entry || {},
          exit: config?.exit || {},
          sizing: config?.sizing || {},
          symbols: config?.symbols || 'auto',
        };
      });

      return { jsonBody: rules };
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

      if (!/^[a-zA-Z0-9_]+$/.test(ruleName)) {
        return { status: 400, jsonBody: { error: 'Invalid rule name' } };
      }

      const existing = await queryOne('SELECT id FROM RULES WHERE name = ?', [ruleName]);
      if (!existing) {
        return { status: 404, jsonBody: { error: 'Rule not found' } };
      }

      const config = JSON.stringify({
        entry: body.entry || {},
        exit: body.exit || {},
        sizing: body.sizing || {},
        symbols: body.symbols || 'auto',
      });

      await query(
        `UPDATE RULES
         SET type = ?, enabled = ?, description = ?,
             config = PARSE_JSON(?), updated_at = CURRENT_TIMESTAMP()
         WHERE name = ?`,
        [body.type, body.enabled, body.description, config, ruleName]
      );

      return { jsonBody: { success: true, name: ruleName } };
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

      const existing = await queryOne('SELECT id FROM RULES WHERE name = ?', [ruleName]);
      if (existing) {
        return { status: 409, jsonBody: { error: `Rule "${ruleName}" already exists` } };
      }

      const config = JSON.stringify({
        entry: body.entry || {},
        exit: body.exit || {},
        sizing: body.sizing || {},
        symbols: body.symbols || 'auto',
      });

      await query(
        `INSERT INTO RULES (name, type, enabled, description, config)
         VALUES (?, ?, ?, ?, PARSE_JSON(?))`,
        [ruleName, body.type, body.enabled, body.description, config]
      );

      return { status: 201, jsonBody: { success: true, name: ruleName } };
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

      const existing = await queryOne('SELECT id FROM RULES WHERE name = ?', [ruleName]);
      if (!existing) {
        return { status: 404, jsonBody: { error: 'Rule not found' } };
      }

      await query('DELETE FROM RULES WHERE name = ?', [ruleName]);
      return { jsonBody: { success: true, name: ruleName } };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
