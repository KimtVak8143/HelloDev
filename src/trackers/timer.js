// coding time tracker
// ─── Coding Time Tracker ──────────────────────────────────────────────────
// Tracks elapsed time from session start to stop

let sessionStart = null;

function startTracking() {
  sessionStart = Date.now();
  console.log(`⏱  Timer started at ${new Date().toLocaleTimeString()}`);
}

function stopTracking(activeSession) {
  const now = Date.now();
  const elapsedMs = now - (sessionStart || now);
  const hours = elapsedMs / (1000 * 60 * 60);

  return {
    hours,
    commits: activeSession.commits.length,
    messages: activeSession.commits,
  };
}

function getElapsed() {
  if (!sessionStart) return "No active session";
  const ms = Date.now() - sessionStart;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

module.exports = { startTracking, stopTracking, getElapsed };