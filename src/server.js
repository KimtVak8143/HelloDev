require("dotenv").config();
const express = require("express");
const { startTask, completeTask, listTasks } = require("./notion/tasks");
const { startTracking, stopTracking, getElapsed } = require("./trackers/timer");
const { applyCommit } = require("./trackers/git");
const log = require("./utils/logger");
const app = express();

// Capture raw body using standard Express middleware that stores it
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf.toString(encoding || "utf8");
    }
  })
);
app.use(log.requestLogger);

// JSON parsing error handler - catches SyntaxErrors from express.json()
app.use((err, req, res, next) => {
  if (err && (err instanceof SyntaxError || err.message.includes("JSON"))) {
    log.error("Malformed JSON in request", {
      message: err.message,
      rawBody: req.rawBody ? req.rawBody.substring(0, 150) : "N/A"
    });
    return res.status(400).json({ error: "Malformed JSON: " + err.message });
  }
  next(err);
});

let activeSession = null;

app.get("/", (req, res) => {
  res.json({
    status: "HelloDev Tracker running",
    session: activeSession
      ? {
          bugId: activeSession.bugId,
          developer: activeSession.developer,
          elapsed: `${getElapsed()} hrs`,
          commits: activeSession.commits.length
        }
      : null
  });
});

app.post("/start", async (req, res) => {
  try {
    const { bugId, developer } = req.body;
    if (!bugId || !developer) {
      return res.status(400).json({ error: "bugId and developer are required" });
    }
    if (activeSession) {
      return res
        .status(409)
        .json({ error: `Session already active for ${activeSession.bugId}. Run /done first.` });
    }

    const { taskId, taskName, logId } = await startTask(bugId, developer);
    activeSession = {
      bugId,
      logId,
      taskId,
      taskName,
      developer,
      startTime: Date.now(),
      commits: [],
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0
    };

    startTracking();
    log.separator();
    log.success(`Session started - ${bugId} | Developer: ${developer}`);
    log.separator();
    res.json({
      status: "started",
      bugId,
      taskName,
      developer,
      logId,
      startedAt: new Date().toISOString()
    });
  } catch (err) {
    log.error("/start failed", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/done", async (req, res) => {
  try {
    const { bugId } = req.body;
    if (!activeSession) {
      return res.status(400).json({ error: "No active session. Use /start first." });
    }
    if (activeSession.bugId !== bugId) {
      return res
        .status(409)
        .json({ error: `Active session is for ${activeSession.bugId}, not ${bugId}` });
    }

    const stats = stopTracking(activeSession);
    const { taskName } = await completeTask(bugId, activeSession.logId, stats);
    const summary = {
      status: "completed",
      bugId,
      taskName,
      developer: activeSession.developer,
      totalHrs: stats.hours.toFixed(2),
      commits: stats.commits,
      filesChanged: stats.filesChanged,
      linesAdded: stats.linesAdded,
      linesRemoved: stats.linesRemoved
    };

    activeSession = null;
    log.separator();
    log.success(
      `Session complete - ${bugId} | ${stats.hours.toFixed(2)} hrs | ${stats.commits} commits`
    );
    log.separator();
    res.json(summary);
  } catch (err) {
    log.error("/done failed", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/commit", (req, res) => {
  if (!activeSession) {
    log.warn("Commit received with no active session - ignored");
    return res.json({ ok: true, note: "No active session, commit ignored" });
  }
  applyCommit(activeSession, req.body);
  res.json({ ok: true, commits: activeSession.commits.length, latest: req.body.message });
});

app.get("/status", (req, res) => {
  if (!activeSession) {
    return res.json({ active: false, message: "No session running" });
  }
  res.json({
    active: true,
    bugId: activeSession.bugId,
    taskName: activeSession.taskName,
    developer: activeSession.developer,
    elapsed: `${getElapsed()} hrs`,
    commits: activeSession.commits.length
  });
});

app.get("/tasks/:developer", async (req, res) => {
  try {
    const tasks = await listTasks(req.params.developer);
    res.json({ developer: req.params.developer, tasks });
  } catch (err) {
    log.error("/tasks failed", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  log.banner();
  log.separator("Server Ready");
  log.info(`Listening on http://localhost:${PORT}`);
  log.info(`LOG_LEVEL: ${process.env.LOG_LEVEL || "INFO"}`);
  log.separator();
});
