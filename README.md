# HelloDev — Agentic Sprint Tracker

**HelloDev** is a developer-friendly sprint tracker that syncs coding sessions, git commits, and task progress directly to Notion. No more manual status updates — just code, commit, and watch your Notion board update automatically.

Perfect for teams that use Notion as their project management tool and want real-time visibility into who's working on what.

## Features

✅ **Automatic Task Tracking** — Mark tasks "In Progress" when you start, "Done" when you finish  
✅ **Git Integration** — Commits are auto-logged via post-commit hook  
✅ **Time Tracking** — Measure active coding time (excluding idle periods)  
✅ **Activity Logs** — Detailed Notion pages capture time, commits, and code stats  
✅ **CLI & MCP Server** — Use the command line OR integrate with Claude/Copilot via MCP  
✅ **Simple JSON Logging** — Plain stdout logs via pino, no complex dashboards  

## Quick Start

### Prerequisites

- Node.js 14+
- A Notion workspace with a Sprint Board database
- Notion API token

### Installation

```bash
# Clone and install
git clone https://github.com/KimtVak8143/HelloDev.git
cd HelloDev
npm install
```

### Configuration

Create a `.env` file:

```env
NOTION_API_KEY=ntn_xxxxxx...
SPRINT_DB_ID=da436b5c...
LOGS_DB_ID=9ab80b43...
PORT=3333
LOG_LEVEL=INFO
```

**Get these values:**
- Open your Notion Sprint Board → Share → Copy API key to `.env`
- Database IDs are the 32-char hex strings in Notion URLs

### Start the Server

```bash
npm run dev                # Start with nodemon (auto-reload)
npm start                  # Start production server
npm run mcp               # Start MCP server for IDE integration
npm run all               # Start both dev server and MCP server
```

## Usage

### CLI Commands

```bash
# List your tasks
hellodev tasks Alice

# Start working on a task
hellodev start bug-#1 --dev Alice

# Check elapsed time
hellodev status

# Mark task done
hellodev done bug-#1
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/` | Health check |
| `POST` | `/start` | Begin tracking a task |
| `POST` | `/done` | Complete active task |
| `GET` | `/status` | Check session status |
| `POST` | `/commit` | Log a git commit |
| `GET` | `/tasks/{developer}` | List tasks for developer |

**Examples:**

```bash
# Start a session
curl -X POST http://localhost:3333/start \
  -H "Content-Type: application/json" \
  -d '{"bugId": "bug-#1", "developer": "Alice"}'

# Check status
curl http://localhost:3333/status

# Complete task
curl -X POST http://localhost:3333/done \
  -H "Content-Type: application/json" \
  -d '{"bugId": "bug-#1"}'
```

### With Claude/Copilot via MCP

Start the MCP server:

```bash
npm run mcp
```

Then in VS Code, add HelloDev to your `~/.copilot/config.json`:

```json
{
  "servers": {
    "hellodev": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/HelloDev/src/mcp/index.js"]
    }
  }
}
```

Now chat naturally in Copilot:
- "What are my tasks?"
- "Start working on bug-#1"
- "How long have I been working?"
- "Mark this as done"

## How It Works

1. **Developer** runs `hellodev start bug-#1 --dev Alice`
   - Task marked "In Progress" in Notion
   - Activity Log sheet created and linked

2. **Developer commits code** via Git
   - Post-commit hook sends commit data to HelloDev
   - Commit logged to the Activity Log

3. **Developer runs** `hellodev done bug-#1`
   - Task marked "Done" in Notion
   - Activity Log sealed with stats:
     - Total active time
     - Commit count & messages
     - Files changed, lines added/removed

4. **Manager** sees real-time updates in Notion
   - No standups needed!

## Project Structure

```
src/
├── server.js              # Express API server
├── cli/
│   └── commands.js        # CLI interface
├── mcp/
│   └── index.js           # MCP server for IDE integration
├── notion/
│   ├── client.js          # Notion SDK instance
│   ├── tasks.js           # Task CRUD operations
│   └── logs.js            # Activity log helpers
├── trackers/
│   ├── git.js             # Git commit tracking
│   └── timer.js           # Session time tracker
└── utils/
    └── logger.js          # pino logger

hooks/
└── post-commit            # Git hook (auto-logs commits)

openapi.yaml              # API specification
```

## Configuration

### LOG_LEVEL

Set verbosity in `.env`:

```env
LOG_LEVEL=debug    # Verbose — all Notion API calls
LOG_LEVEL=info     # Default — normal dev mode
LOG_LEVEL=error    # Silent — production
```

Logs output as JSON to stdout via pino.

### Notion Database Schema

**Sprint Board** (`SPRINT_DB_ID`):
- Bug/Feature ID (text)
- Task Name (title)
- Status (select: Todo, In Progress, Done)
- Assigned To (text)
- Priority (select: High, Medium, Low)
- Story Points (number)
- Log Sheet (relation → Logs DB)

**Activity Logs** (`LOGS_DB_ID`):
- Log Title (title)
- Developer (text)
- Session Start (date)
- Session End (date)
- Total Time (hrs) (number)
- Commits Count (number)
- Commit Messages (text)
- Files Changed (number)
- Lines Added (number)
- Lines Removed (number)
- Status (select: Active, Completed)
- Task (Linked) (relation → Sprint Board)

## Development

### Running Tests

```bash
npm test
```

### Git Hook Setup

The post-commit hook auto-logs commits. Set it up:

```bash
chmod +x hooks/post-commit
cp hooks/post-commit .git/hooks/
```

### Building for Production

```bash
npm run build
npm start
```

## Troubleshooting

### "Notion API Connection Failed"

- Check `.env` has valid `NOTION_API_KEY`
- Run: `npm run test-connection`

### "Task not found in Sprint Board"

- Verify task ID matches exactly (case-sensitive)
- Confirm `SPRINT_DB_ID` is correct

### "No active session"

- Run `/start` first to create a session
- Check active session: `GET /status`

## License

ISC

## Support

- 📖 [API Docs](openapi.yaml)
- 🐛 [GitHub Issues](https://github.com/KimtVak8143/HelloDev/issues)
- 💬 Questions? Open a discussion!

---

**HelloDev** — Track your work. Sync your progress. Stay focused. 🚀
