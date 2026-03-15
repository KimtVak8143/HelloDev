# HelloDev Tracker (VSCode Extension)

HelloDev Tracker is a VSCode extension that tracks developer task progress in Notion, logs coding sessions, ingests git commits, and can generate standup reports on demand.

## What it does

- Maintainer onboarding creates required Notion databases.
- Developer onboarding stores token securely and detects git identity.
- My Tasks reads assigned tasks from Sprint Board.
- Start Task marks task in progress and creates an activity log.
- Complete Task seals log with time and commit stats, marks task done.
- Git hook writes commit payload to `.hellodev/pending-commit.json`; extension watcher ingests it.
- Generate Standup creates last-24h summary, opens preview panel, optional Notion publish.

## Required Notion setup

- A Notion integration token (`ntn_...`).
- A parent page shared with the integration (for maintainer setup).
- Databases used by HelloDev:
  - Sprint Board
  - Activity Logs
  - Developers

## Local development

```bash
npm install
```

In VSCode:

1. Open this folder.
2. Press `F5` to launch Extension Development Host.
3. Run `HelloDev: Open Onboarding`.

## Key commands

- `HelloDev: Open Onboarding`
- `HelloDev: My Tasks`
- `HelloDev: Start Task`
- `HelloDev: View Status`
- `HelloDev: Complete Task`
- `HelloDev: Install Git Hook`
- `HelloDev: Generate Standup`

## Package VSIX

```bash
npm run package:vsix
```

## Notes

- On-demand standup only (no scheduler enabled).
- MCP stdio host is opt-in via `HELLODEV_ENABLE_MCP_STDIO=1`.
