# HelloDev Tracker

<p align="center">
  <img alt="HelloDev Logo" src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:0f766e,100:0ea5e9&text=HelloDev&fontSize=64&fontColor=ffffff&fontAlignY=38&desc=Agentic%20Sprint%20Tracker&descAlignY=58&animation=fadeIn" />
</p>
<p align="center"><strong>Powered by Notion</strong></p>

HelloDev Tracker is a VS Code extension for sprint execution on top of Notion:

- assigns and starts tasks based on your git identity
- tracks active coding sessions with persisted local state
- ingests commit metadata into Notion activity logs
- generates and optionally publishes standup updates

## Current functionality

- Role-based onboarding in a webview (`Maintainer` or `Developer`)
- Secure token storage via VS Code secrets
- Maintainer workspace setup that creates/reuses:
  - `Sprint Board`
  - `Activity Logs`
  - `Developers`
- Developer auto-upsert into `Developers` DB (when git identity is complete)
- Task lifecycle:
  - `My Tasks` lists assigned non-done items
  - `Start Task` marks task `In Progress` and opens log entry
  - `View Status` shows elapsed time + commit count
  - `Complete Task` marks task `Done` and finalizes log stats
- Commit ingestion pipeline:
  - Git hook writes `.hellodev/pending-commit.json`
  - Extension file watcher ingests payload and updates active log stats
- Session persistence:
  - active session saved to `.hellodev/session.json`
  - restored automatically when extension reactivates
- Standup:
  - generates last-24h report from `Activity Logs`
  - opens preview panel
  - optional publish to Notion page (parent page ID persisted)
- Optional MCP stdio host (disabled by default)

## VS Code commands

- `HelloDev: Open Onboarding`
- `HelloDev: My Tasks`
- `HelloDev: Start Task`
- `HelloDev: View Status`
- `HelloDev: Complete Task`
- `HelloDev: Install Git Hook`
- `HelloDev: Generate Standup`

## Onboarding flow

1. Run `HelloDev: Open Onboarding`.
2. Choose role:
   - `Maintainer`: enter token and parent page ID, then databases are created/reused.
   - `Developer`: enter token, detect git identity, and upsert profile in `Developers`.
3. Start working with `My Tasks` / `Start Task`.

## Local development

```bash
npm install
```

Then in VS Code:

1. Open this folder.
2. Press `F5` to launch Extension Development Host.
3. Run `HelloDev: Open Onboarding`.

## Scripts

- `npm run dev` - run extension entrypoint
- `npm run mcp` - run MCP server
- `npm run all` - run dev + MCP together
- `npm run test` - run tests
- `npm run verify` - lint + format check + tests
- `npm run package:vsix` - build VSIX package

## Configuration notes

- MCP stdio host is opt-in: set `HELLODEV_ENABLE_MCP_STDIO=1`.
- Standup publishing requires a Notion parent page ID (prompted on first publish).
- No background scheduler for standups; generation is command-driven.
