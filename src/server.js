const express = require("express");
const { startTask, completeTask, getMyTasks } = require("./notion/tasks");
const { startTracking, stopTracking, getElapsed } = require("./trackers/timer");
require("dotenv").config();

const app = express();
app.use(express.json());

// ─── Active Session State ─────────────────────────────────────────────────
let activeSession = null;
// activeSession = { bugId, logId, taskId, developer, startTime, commits: [] }

// ─── Health Check ─────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "🚀 XYZ Tracker running",
    activeSession: activeSession
      ? {
          bugId: activeSession.bugId,
          developer: activeSession.developer,
          elapsed: getElapsed(),
          commits: activeSession.commits.length,
        }
      : null,
  });
});

// ─── POST /start ──────────────────────────────────────────────────────────
// Body: { bugId: "bug-#1", developer: "Alice" }
app.post("/start", async (req, res) => {
  try {
    const { bugId, developer } = req.body;

    if (!bugId || !developer) {
      return res.status(400).json({ error: "bugId and developer are required" });
    }

    if (activeSession) {
      return res.status(400).json({
        error: `Already tracking "${activeSession.bugId}". Run /done first.`,
      });
    }

    const { taskId, logId } = await startTask(bugId, developer);

    activeSession = {
      bugId,
      logId,
      taskId,
      developer,
      startTime: Date.now(),
      commits: [],
    };

    startTracking();

    res.json({
      status: "started",
      bugId,
      developer,
      logId,
      message: `✅ Now tracking "${bugId}" for ${developer}`,
    });
  } catch (err) {
    console.error("❌ /start error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /done ───────────────────────────────────────────────────────────
// Body: { bugId: "bug-#1" }
app.post("/done", async (req, res) => {
  try {
    const { bugId } = req.body;

    if (!activeSession) {
      return res.status(400).json({ error: "No active session. Use /start first." });
    }

    if (activeSession.bugId !== bugId) {
      return res.status(400).json({
        error: `Active session is for "${activeSession.bugId}", not "${bugId}"`,
      });
    }

    const stats = stopTracking(activeSession);
    await completeTask(bugId, activeSession.logId, stats);

    const summary = {
      status: "completed",
      bugId,
      developer: activeSession.developer,
      totalTime: `${stats.hours.toFixed(2)} hrs`,
      commits: stats.commits,
      message: `🎉 "${bugId}" marked as Done!`,
    };

    activeSession = null;
    res.json(summary);
  } catch (err) {
    console.error("❌ /done error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /commit ─────────────────────────────────────────────────────────
// Called automatically by git post-commit hook
// Body: { message: "fix: resolved login bug" }
app.post("/commit", (req, res) => {
  if (!activeSession) {
    return res.json({ ok: false, reason: "No active session" });
  }

  const { message } = req.body;
  activeSession.commits.push(message);

  console.log(`📝 Commit #${activeSession.commits.length}: ${message}`);
  res.json({ ok: true, totalCommits: activeSession.commits.length });
});

// ─── GET /status ──────────────────────────────────────────────────────────
app.get("/status", (req, res) => {
  if (!activeSession) {
    return res.json({ active: false, message: "No task in progress" });
  }

  res.json({
    active: true,
    bugId: activeSession.bugId,
    developer: activeSession.developer,
    elapsed: getElapsed(),
    commits: activeSession.commits.length,
    commitMessages: activeSession.commits,
  });
});

// ─── GET /tasks/:developer ────────────────────────────────────────────────
// Get all pending tasks for a developer
app.get("/tasks/:developer", async (req, res) => {
  try {
    const tasks = await getMyTasks(req.params.developer);
    res.json({ developer: req.params.developer, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║       🚀 XYZ Tracker Server          ║
║       Running on port ${PORT}          ║
╠══════════════════════════════════════╣
║  POST /start   → begin task tracking ║
║  POST /done    → complete task       ║
║  POST /commit  → log git commit      ║
║  GET  /status  → current session     ║
║  GET  /tasks/:dev → view my tasks    ║
╚══════════════════════════════════════╝
  `);
});