# CLAUDE.md — Project Working Guidelines

## Git & CI Discipline

- **Do NOT push iterative/WIP commits** to `dev` or `main` to test changes. Each push triggers an Azure Static Web Apps CI/CD run. Batch all related changes into a single complete commit before opening a PR.
- **Do NOT open, close, or reopen PRs to test partial work.** Each PR lifecycle event (open/close) triggers a separate workflow run. Only open a PR when the work is ready to pass a build.
- If a build is expected to fail (e.g., missing env vars, incomplete config), note it explicitly and do not push until it is ready to succeed.
- Only the `main` branch deployment matters for production. `dev` builds are preview-only.
- Preferred branch flow: `dev` → PR → `main`. Do not bypass PRs for anything that touches production config.

## Secrets & Environment Variables

- **Never commit secrets, tokens, keys, or connection strings to git** — not even temporarily. This repo is monitored by GitGuardian.
- All secrets must be stored as:
  - **Azure SWA Application Settings** (for runtime API keys and connection strings)
  - **GitHub Secrets** (for CI/CD workflow credentials)
- Reference secrets by environment variable name in code (e.g., `process.env.ARCHIVE_API_KEY`). Never hardcode values.
- If a secret is accidentally committed, treat it as compromised immediately — rotate it before cleaning git history.

## How to Communicate Changes

- When Azure Portal steps are required (app settings, redirect URIs, CORS rules, etc.), list them as **numbered manual steps** — do not attempt to automate portal actions via CLI unless explicitly asked.
- When Snowflake changes are needed, provide the exact SQL statements (`ALTER`, `CREATE OR REPLACE`, etc.) ready to run — show current values before changing them.
- Always confirm whether a secret or config value will be visible in plaintext in any committed file.

## Project Stack Context

- **Frontend:** Azure Static Web Apps (SWA), embedded in Bridge/Omni via iframe
- **Backend APIs:** SWA API functions (Node.js)
- **Data layer:** Snowflake (`<FILL IN: DATABASE.SCHEMA>` — confirm before running any DDL), stored procedures, UDFs, network rules
- **Auth:** Azure Entra ID (AAD), app registration `<FILL IN: app registration ID>` — redirect URIs must be registered for each environment
- **Notifications:** Microsoft Teams webhooks
- **CI/CD:** GitHub Actions — `Azure Static Web Apps CI/CD` workflow

## Snowflake Notes

- Default session role issues have occurred with `ACCOUNTADMIN` — always confirm the active role before running DDL.
- Stored procedures use JavaScript/SQL interop — be careful with null coalescing and quote escaping.
- Network rules must be updated when the SWA domain changes (e.g., preview → production → custom domain).

## General Preferences

- Provide prompts and instructions as **exact text ready to paste** rather than describing what to do in general terms.
- When multiple steps are required, sequence them clearly and flag which steps must be done in order vs. can be done in parallel.
- Flag any action that could affect production data or auth before executing it.
