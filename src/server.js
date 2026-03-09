// Main Server

const express = require("express");
const { startTask, completeTask } = require("./notion/tasks");
const { startTracking, stopTracking } = require("./trackers/timer");

const app = express();
app.use(express.json());

let activeSession = null; // { bugId, logId, developerName, startTime, commits:[] }

// POST /start  body: { bugId, developer }
app.post("/start", async (req, res) => {
  const { bugId, developer } = req.body;
  const { taskId, logId } = await startTask(bugId, developer);
  activeSession = { bugId, logId, taskId, developer, startTime: Date.now(), commits: [] };
  startTracking();
  console.log(`✅ Started tracking: ${bugId}`);
  res.json({ status: "started", bugId, logId });
});

// POST /done  body: { bugId }
app.post("/done", async (req, res) => {
  if (!activeSession) return res.status(400).json({ error: "No active session" });
  const stats = stopTracking(activeSession);
  await completeTask(activeSession.bugId, activeSession.logId, stats);
  console.log(`🎉 Completed: ${activeSession.bugId}`);
  activeSession = null;
  res.json({ status: "completed" });
});

// POST /commit  (called by git hook)
app.post("/commit", (req, res) => {
  if (activeSession) {
    activeSession.commits.push(req.body.message);
    console.log(`📝 Commit logged: ${req.body.message}`);
  }
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3333, () => {
  console.log(`🚀 XYZ Server running on port ${process.env.PORT || 3333}`);
});