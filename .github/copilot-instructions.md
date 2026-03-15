# HelloDev — Complete Project Summary for Codex Agent

---

## What Is HelloDev?

A VSCode extension that acts as an agentic sprint tracker for development teams. It eliminates manual standups by automatically tracking coding time, git commits, and task status — syncing everything to Notion in real time. Two roles: **Maintainer** (Scrum Master) sets up the workspace once, **Developers** install the extension and just work.

---

## Core Architecture

```
VSCode Extension (single process)
├── MCP Server (stdio)           ← Copilot Chat integration
├── Local HTTP listener          ← tiny, only for git hook
├── Notion client                ← all DB operations
├── File watcher                 ← watches .hellodev/pending-commit.json
├── Timer tracker                ← coding time + idle detection
├── Git hook installer           ← auto-prompts per repo
└── Status bar                   ← ● HelloDev: bug-#3 (1h 24m)

Git Hook (post-commit bash/powershell)
└── writes → .hellodev/pending-commit.json
    └── MCP file watcher picks it up → logs to Notion → deletes file
```

No Express server. No shared server. No `.env` for developers. The extension is the entire backend.

---

## Onboarding Flow

### First Launch — Role Picker Webview
```
Welcome to HelloDev
[ Maintainer ]     [ Developer ]
```

### Maintainer Path
1. Select Maintainer
2. Notion OAuth → token saved to VSCode `secretStorage`
3. Extension auto-creates 3 Notion DBs with correct schemas
4. Maintainer invites developers to Notion workspace by email
5. Creates tasks in Sprint Board, assigns by developer name
6. Monitors Notion dashboard — no further setup needed

### Developer Path
1. Select Developer
2. Notion OAuth → token saved to VSCode `secretStorage`
3. Extension reads `git config --global user.name` + `user.email` for identity
4. On every workspace open: checks for git hook, prompts to install if missing
5. MCP server starts automatically
6. Developer works — extension tracks everything

---

## Notion Workspace Setup

**Workspace name:** HelloDev (must be Teamspace, NOT Private — private blocks API)
**Integration name:** HelloDev Tracker (token starts with `ntn_`)
**Three databases, all connected to the integration:**

### Sprint Board (`SPRINT_DB_ID`)
| Field | Type | Notes |
|---|---|---|
| Task Name | Title | |
| Bug/Feature ID | Rich Text | e.g. bug-#1, feature-#2 |
| Status | Select | Todo / In Progress / Done / Blocked |
| Priority | Select | High / Medium / Low |
| Assigned To | Rich Text | Must match git config name exactly |
| Sprint | Select | Sprint 1 / 2 / 3 |
| Task Type | Select | Bug / Feature / Chore / Review |
| Story Points | Number | |
| Log Sheet | Relation | → Activity Logs DB |

### Activity Logs (`LOGS_DB_ID`)
| Field | Type | Notes |
|---|---|---|
| Log Title | Title | Auto: Dev — bugId — Date |
| Developer | Rich Text | |
| Task (Linked) | Relation | → Sprint Board |
| Session Start | Date | |
| Session End | Date | |
| Total Time (hrs) | Number | |
| Commits Count | Number | |
| Commit Messages | Rich Text | Pipe-separated |
| Files Changed | Number | |
| Lines Added | Number | |
| Lines Removed | Number | |
| Status | Select | Active / Completed |

### Developers (`DEVS_DB_ID`)
| Field | Type | Notes |
|---|---|---|
| Name | Title | Must match git config exactly |
| Email | Email | |
| Role | Select | Maintainer / Developer |

---

## File Structure

```
hellodev-vscode/
├── src/
│   ├── extension.js                  # Entry point — activate/deactivate
│   ├── onboarding/
│   │   ├── OnboardingPanel.js        # Webview — role picker + OAuth flow
│   │   ├── notionAuth.js             # OAuth PKCE flow + secretStorage
│   │   └── setupMaintainer.js        # Auto-creates all 3 Notion DBs
│   ├── mcp/
│   │   └── index.js                  # MCP server stdio — all tools
│   ├── notion/
│   │   ├── client.js                 # Notion client — reads token from secretStorage
│   │   ├── tasks.js                  # startTask, completeTask, listTasks
│   │   ├── logs.js                   # Activity log create/update/seal
│   │   └── standup.js                # Phase 6 — daily standup generator
│   ├── trackers/
│   │   ├── timer.js                  # Session timer + idle detection (5min threshold)
│   │   ├── gitHook.js                # Hook installer + .hellodev/ dir manager
│   │   └── fileWatcher.js            # fs.watch on pending-commit.json
│   ├── ui/
│   │   ├── statusBar.js              # ● HelloDev status bar item
│   │   ├── taskPicker.js             # Quick pick — select task from Notion
│   │   └── standupPanel.js           # Webview — standup report preview
│   └── utils/
│       ├── logger.js                 # VSCode Output Channel logger
│       └── identity.js               # git config user.name/email resolver
├── hooks/
│   ├── post-commit                   # Bash version (Mac/Linux)
│   └── post-commit.ps1               # PowerShell version (Windows)
├── .hellodev/                        # Per-repo runtime dir (gitignored)
│   ├── pending-commit.json           # Git hook writes here, watcher consumes
│   └── session.json                  # Active session state (MCP writes)
├── package.json                      # Extension manifest + contributes
└── README.md
```

---

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Notion SDK | `@notionhq/client@2.2.15` | v5.x has breaking API changes — pin this |
| MCP transport | stdio | VSCode MCP standard |
| Auth | Notion OAuth PKCE | No token sharing between users |
| Token storage | VSCode `secretStorage` | Encrypted, per-user, never in .env |
| Developer identity | `git config --global user.name/email` | Zero manual input |
| Git hook → MCP | File write to `.hellodev/pending-commit.json` | No HTTP, no port, debuggable |
| Session guard | `session.json` existence check | Hook exits silently if MCP not running |
| Express server | Eliminated | MCP extension handles everything |
| Windows support | PowerShell hook (`post-commit.ps1`) | Bash doesn't run natively on Windows |
| Idle detection | 5 minute threshold | Pause timer when developer stops typing |
| Multi-repo | Per-repo `.hellodev/` dir | Each repo independent, no cross-contamination |

---

## Git Hook Logic

### Bash (`hooks/post-commit`)
```bash
#!/bin/bash
HELLODEV_DIR="$(git rev-parse --show-toplevel)/.hellodev"

# Silent exit if MCP not running
[ ! -f "$HELLODEV_DIR/session.json" ] && exit 0

HASH=$(git rev-parse HEAD)
MESSAGE=$(git log -1 --pretty=%B)
FILES=$(git diff-tree --no-commit-id -r --name-only HEAD | wc -l)
ADDED=$(git diff HEAD~1 --shortstat | grep -o '[0-9]* insertion' | grep -o '[0-9]*')
REMOVED=$(git diff HEAD~1 --shortstat | grep -o '[0-9]* deletion' | grep -o '[0-9]*')

cat > "$HELLODEV_DIR/pending-commit.json" << EOF
{
  "hash": "$HASH",
  "message": "$MESSAGE",
  "filesChanged": $FILES,
  "linesAdded": ${ADDED:-0},
  "linesRemoved": ${REMOVED:-0},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

### PowerShell (`hooks/post-commit.ps1`)
Same logic, PowerShell syntax. Git hook calls this on Windows.

---

## File Watcher Logic

```javascript
// src/trackers/fileWatcher.js
const pendingCommit = path.join(workspaceRoot, '.hellodev', 'pending-commit.json');

fs.watch(hellodevDir, async (eventType, filename) => {
  if (filename !== 'pending-commit.json') return;
  if (!fs.existsSync(pendingCommit)) return;

  const commit = JSON.parse(fs.readFileSync(pendingCommit, 'utf8'));
  await logCommitToNotion(commit);   // update Activity Log in Notion
  fs.unlinkSync(pendingCommit);      // consume — prevent re-trigger
});
```

---

## MCP Tools

| Tool | Description |
|---|---|
| `list_tasks` | List pending tasks assigned to current developer |
| `start_task` | Start tracking — marks In Progress in Notion, creates Activity Log |
| `complete_task` | Complete task — marks Done, seals log with final time/commits |
| `get_status` | Current session elapsed time + commit count |
| `get_sprint` | Full Sprint Board grouped by status (Todo/In Progress/Done/Blocked) |
| `log_commit` | Manually log a commit via chat (backup for when hook not installed) |
| `generate_standup` | Trigger daily standup report from Copilot Chat |

---

## VSCode Commands

| Command | Palette Label |
|---|---|
| `hellodev.startTask` | HelloDev: Start Task |
| `hellodev.completeTask` | HelloDev: Complete Task |
| `hellodev.viewStatus` | HelloDev: View Status |
| `hellodev.myTasks` | HelloDev: My Tasks |
| `hellodev.generateStandup` | HelloDev: Generate Standup |
| `hellodev.installGitHook` | HelloDev: Install Git Hook |
| `hellodev.openOnboarding` | HelloDev: Open Onboarding |

---

## Phase 6 — Auto Standup Report (Highest Priority)

Query all Activity Logs from last 24 hours, group by developer, generate a Notion page:

```
Standup — March 14 2026
────────────────────────
Alice
  Tasks completed: bug-#3, feature-#7
  Hours coded: 4.5
  Commits: 12
  Blockers: none

Bob
  Tasks completed: feature-#5
  Hours coded: 3.2
  Commits: 8
  Blockers: bug-#9 (still In Progress)
```

Triggers: `HelloDev: Generate Standup` command, MCP `generate_standup` tool, or daily cron at configurable time (default 6pm) via `setInterval` on extension activation.

---

## Build Order for Codex

```
1. package.json + extension.js scaffold          (entry point, commands, activation)
2. OnboardingPanel.js                            (webview — role picker + OAuth)
3. notionAuth.js                                 (OAuth PKCE + secretStorage)
4. setupMaintainer.js                            (auto-create 3 Notion DBs)
5. notion/client.js                              (reads token from secretStorage)
6. notion/tasks.js                               (startTask, completeTask, listTasks)
7. notion/logs.js                                (activity log operations)
8. trackers/timer.js                             (session timer + idle detection)
9. trackers/gitHook.js                           (hook installer, .hellodev/ setup)
10. trackers/fileWatcher.js                      (fs.watch → logCommitToNotion)
11. hooks/post-commit + post-commit.ps1          (bash + powershell versions)
12. ui/statusBar.js                              (● HelloDev status bar)
13. ui/taskPicker.js                             (quick pick from Notion tasks)
14. mcp/index.js                                 (all MCP tools, stdio transport)
15. notion/standup.js + ui/standupPanel.js       (Phase 6 — standup report)
16. utils/identity.js + utils/logger.js          (git config reader, output channel)
```

---

## What Already Exists (Port From Current Project)

| File | Status | Change |
|---|---|---|
| `src/notion/tasks.js` | Port directly | None |
| `src/trackers/timer.js` | Port directly | None |
| `src/mcp/index.js` | Port + extend | Add `get_sprint`, `log_commit`, `generate_standup` tools |
| `src/utils/logger.js` | Port | Swap `console.log` → VSCode Output Channel |
| `src/notion/client.js` | Port + modify | Swap `.env` token → `secretStorage` token |
| `src/server.js` | Eliminate | Replaced by file watcher |
| `src/cli/commands.js` | Eliminate | Replaced by VSCode commands |
| `hooks/post-commit` | Modify | Remove `curl`, write JSON file instead |

---

## Prompt to Give Codex

> Build a VSCode extension called `hellodev-tracker`. Use the file structure, architecture, Notion schemas, MCP tools, git hook logic, file watcher pattern, and build order defined above. The extension has no Express server — the MCP server (stdio) is the backend. Auth is Notion OAuth with tokens in VSCode `secretStorage`. Developer identity comes from `git config --global user.name/email`. The git hook writes to `.hellodev/pending-commit.json` which the extension watches via `fs.watch`. Use `@notionhq/client@2.2.15` — do not upgrade. Use CommonJS (no TypeScript). Build in the order listed. Start with the extension scaffold and onboarding webview.