"use strict";

const fs = require("fs");
const {
  ensureHelloDevDir,
  getHelloDevDir,
  getPendingCommitPath,
  saveSession
} = require("../runtime/sessionStore");
const { syncActiveLogStats } = require("../notion/runtimeTasks");

function normalizeCommitPayload(commit) {
  return {
    message: commit.message || "",
    filesChanged: Number(commit.filesChanged || 0),
    linesAdded: Number(commit.linesAdded || 0),
    linesRemoved: Number(commit.linesRemoved || 0)
  };
}

async function processPendingCommit(state, output) {
  const pendingPath = getPendingCommitPath();
  if (!fs.existsSync(pendingPath)) {
    return;
  }

  const active = state.getActiveSession();
  if (!active) {
    fs.unlinkSync(pendingPath);
    return;
  }

  const payload = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
  const commit = normalizeCommitPayload(payload);
  active.commits.push(commit.message);
  active.filesChanged += commit.filesChanged;
  active.linesAdded += commit.linesAdded;
  active.linesRemoved += commit.linesRemoved;
  state.setActiveSession(active);
  saveSession(active);

  try {
    await syncActiveLogStats(state, active);
  } catch (error) {
    output.warn(`Could not sync active log stats yet: ${error.message}`);
  }

  fs.unlinkSync(pendingPath);
  output.info(`Commit ingested for active task: ${active.taskId}`);
}

function startPendingCommitWatcher(state, output) {
  ensureHelloDevDir();
  const dir = getHelloDevDir();
  const watcher = fs.watch(dir, async (_eventType, filename) => {
    if (filename !== "pending-commit.json") {
      return;
    }
    try {
      await processPendingCommit(state, output);
    } catch (error) {
      output.error(`Commit watcher error: ${error.message}`);
    }
  });

  output.info("Pending commit watcher started");
  return watcher;
}

module.exports = {
  startPendingCommitWatcher
};
