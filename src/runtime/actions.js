"use strict";

const { getGitIdentity } = require("../utils/identity");
const {
  listTasksForDeveloper,
  startTaskForDeveloper,
  completeTaskForDeveloper,
  listSprintBoard,
  upsertDeveloper,
  generateStandupReport,
  syncActiveLogStats,
  publishStandupToNotion
} = require("../notion/runtimeTasks");
const { clearSession, saveSession } = require("./sessionStore");

function formatElapsed(startedAt) {
  const ms = Math.max(Date.now() - new Date(startedAt).getTime(), 0);
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

async function requireDeveloperIdentity() {
  const identity = await getGitIdentity();
  if (!identity.name) {
    throw new Error("Git user.name is missing.");
  }
  return identity;
}

async function getMyTasks(state) {
  const identity = await requireDeveloperIdentity();
  const tasks = await listTasksForDeveloper(state, identity.name);
  return { identity, tasks };
}

async function startTask(state, task) {
  const current = state.getActiveSession();
  if (current) {
    throw new Error(`Active task already running: ${current.taskId} (${current.taskName}).`);
  }

  const identity = await requireDeveloperIdentity();
  const session = await startTaskForDeveloper(state, task, identity.name);
  const activeSession = {
    ...session,
    commits: [],
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0
  };

  state.setActiveSession(activeSession);
  saveSession(activeSession);
  return activeSession;
}

function getStatus(state) {
  const active = state.getActiveSession();
  if (!active) {
    return { active: false };
  }
  return {
    active: true,
    taskId: active.taskId,
    taskName: active.taskName,
    developer: active.developerName,
    commits: active.commits.length,
    elapsed: formatElapsed(active.startedAt)
  };
}

async function completeTask(state) {
  const active = state.getActiveSession();
  if (!active) {
    throw new Error("No active session to complete.");
  }

  const result = await completeTaskForDeveloper(state, active);
  state.clearActiveSession();
  clearSession();
  return { active, result };
}

async function registerDeveloper(state, role) {
  const identity = await requireDeveloperIdentity();
  return upsertDeveloper(state, identity, role || "developer");
}

async function getSprint(state) {
  return listSprintBoard(state);
}

async function logCommit(state, commit) {
  const active = state.getActiveSession();
  if (!active) {
    throw new Error("No active session running.");
  }
  active.commits.push(commit.message || "");
  active.filesChanged += Number(commit.filesChanged || 0);
  active.linesAdded += Number(commit.linesAdded || 0);
  active.linesRemoved += Number(commit.linesRemoved || 0);
  state.setActiveSession(active);
  saveSession(active);
  await syncActiveLogStats(state, active);
  return { commits: active.commits.length };
}

async function generateStandup(state) {
  return generateStandupReport(state);
}

async function publishStandup(state, report) {
  return publishStandupToNotion(state, report);
}

module.exports = {
  getMyTasks,
  startTask,
  getStatus,
  completeTask,
  registerDeveloper,
  getSprint,
  logCommit,
  generateStandup,
  publishStandup
};
