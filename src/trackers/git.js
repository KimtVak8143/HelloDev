// git commit listener
const { recordActivity } = require("./timer");
const logger = require("../utils/logger");

function applyCommit(session, payload) {
  if (!session) {
    logger.warn("Commit received but no active session — ignored");
    return;
  }

  const stats = {
    message:      payload.message      || "",
    filesChanged: payload.filesChanged || 0,
    linesAdded:   payload.linesAdded   || 0,
    linesRemoved: payload.linesRemoved || 0
  };

  session.commits.push(stats.message);
  session.filesChanged = (session.filesChanged || 0) + stats.filesChanged;
  session.linesAdded   = (session.linesAdded   || 0) + stats.linesAdded;
  session.linesRemoved = (session.linesRemoved || 0) + stats.linesRemoved;

  recordActivity();

  logger.info(`Commit #${session.commits.length} logged`, {
    message:      stats.message,
    filesChanged: stats.filesChanged,
    linesAdded:   stats.linesAdded,
    linesRemoved: stats.linesRemoved
  });
}

module.exports = { applyCommit };