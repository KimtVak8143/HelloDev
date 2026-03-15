const logger = require("../utils/logger");

let sessionStart   = null;
let idleTimer      = null;
let totalIdleMs    = 0;
let lastActivityAt = null;

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

function startTracking() {
  sessionStart   = Date.now();
  lastActivityAt = Date.now();
  totalIdleMs    = 0;

  idleTimer = setInterval(() => {
    const idleSince = Date.now() - lastActivityAt;
    if (idleSince > IDLE_THRESHOLD_MS) {
      totalIdleMs += 60 * 1000;
      logger.timer("Idle detected, excluding 1 min", { totalIdleMins: (totalIdleMs / 60000).toFixed(1) });
    }
  }, 60 * 1000);

  logger.timer("Session timer started", { at: new Date().toLocaleTimeString() });
}

function recordActivity() {
  lastActivityAt = Date.now();
}

function stopTracking(session) {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }

  const totalMs     = Date.now() - sessionStart;
  const activeMs    = totalMs - totalIdleMs;
  const activeHours = activeMs / (1000 * 60 * 60);

  const stats = {
    hours:        activeHours,
    commits:      session.commits.length,
    messages:     session.commits,
    filesChanged: session.filesChanged || 0,
    linesAdded:   session.linesAdded   || 0,
    linesRemoved: session.linesRemoved || 0
  };

  logger.timer("Session stopped", {
    totalMins:  (totalMs / 60000).toFixed(1),
    activeMins: (activeMs / 60000).toFixed(1),
    idleMins:   (totalIdleMs / 60000).toFixed(1),
    activeHrs:  activeHours.toFixed(2)
  });

  return stats;
}

function getElapsed() {
  if (!sessionStart) {return "0.00";}
  return ((Date.now() - sessionStart) / (1000 * 60 * 60)).toFixed(2);
}

module.exports = { startTracking, stopTracking, recordActivity, getElapsed };