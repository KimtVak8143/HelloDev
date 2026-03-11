const express  = require("express");
const logger   = require("./utils/logger");
const { startTask, completeTask, listTasks } = require("./notion/tasks");
const { startTracking, stopTracking, getElapsed } = require("./trackers/timer");
const { applyCommit } = require("./trackers/git");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(logger.requestLogger);

let activeSession = null;

// ── GET / ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:  "🚀 XYZ Tracker running",
    session: activeSession ? {
      bugId: activeSession.bugId, developer: activeSession.developer,
      elapsed: `${getElapsed()} hrs`, commits: activeSession.commits.length
    } : null
  });
});

// ── POST /start ───────────────────────────────────────────────────────────────
app.post("/start", async (req, res) => {
  try {
    const { bugId, developer } = req.body;
    if (!bugId || !developer)
      return res.status(400).json({ error: "bugId and developer are required" });
    if (activeSession)
      return res.status(409).json({ error: `Session already active for ${activeSession.bugId}. Run /done first.` });

    const { taskId, taskName, logId } = await startTask(bugId, developer);
    activeSession = { bugId, logId, taskId, taskName, developer, startTime: Date.now(), commits: [], filesChanged: 0, linesAdded: 0, linesRemoved: 0 };
    startTracking();

    logger.server("Active session created", { bugId, developer, logId });
    res.json({ status: "started", bugId, taskName, developer, logId, startedAt: new Date().toISOString() });

  } catch (err) {
    logger.error("/start failed", { message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /done ────────────────────────────────────────────────────────────────
app.post("/done", async (req, res) => {
  try {
    const { bugId } = req.body;
    if (!activeSession)
      return res.status(400).json({ error: "No active session. Use /start first." });
    if (activeSession.bugId !== bugId)
      return res.status(409).json({ error: `Active session is for ${activeSession.bugId}, not ${bugId}` });

    const stats = stopTracking(activeSession);
    const { taskName } = await completeTask(bugId, activeSession.logId, stats);

    const summary = {
      status: "completed", bugId, taskName, developer: activeSession.developer,
      totalHrs: stats.hours.toFixed(2), commits: stats.commits,
      filesChanged: stats.filesChanged, linesAdded: stats.linesAdded, linesRemoved: stats.linesRemoved
    };

    logger.server("Session closed", summary);
    activeSession = null;
    res.json(summary);

  } catch (err) {
    logger.error("/done failed", { message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /commit ──────────────────────────────────────────────────────────────
app.post("/commit", (req, res) => {
  if (!activeSession) {
    logger.warn("Commit received with no active session");
    return res.json({ ok: true, note: "No active session, commit ignored" });
  }
  applyCommit(activeSession, req.body);
  res.json({ ok: true, commits: activeSession.commits.length, latest: req.body.message });
});

// ── GET /status ───────────────────────────────────────────────────────────────
app.get("/status", (req, res) => {
  if (!activeSession) return res.json({ active: false, message: "No session running" });
  res.json({
    active: true, bugId: activeSession.bugId, taskName: activeSession.taskName,
    developer: activeSession.developer, elapsed: `${getElapsed()} hrs`, commits: activeSession.commits.length
  });
});

// ── GET /tasks/:developer ─────────────────────────────────────────────────────
app.get("/tasks/:developer", async (req, res) => {
  try {
    const tasks = await listTasks(req.params.developer);
    res.json({ developer: req.params.developer, tasks });
  } catch (err) {
    logger.error("/tasks failed", { message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  logger.section("XYZ Tracker Server");
  logger.server(`Running on http://localhost:${PORT}`);
  logger.server(`Log file → ${logger.logFile}`);
  logger.info("Available endpoints:");
  logger.debug("  GET  /              → health check");
  logger.debug("  POST /start         → start tracking");
  logger.debug("  POST /done          → complete task");
  logger.debug("  POST /commit        → log git commit");
  logger.debug("  GET  /status        → session info");
  logger.debug("  GET  /tasks/:dev    → list tasks\n");
});