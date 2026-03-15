"use strict";

const axios = require("axios");

function requireWorkspaceConfig(state) {
  const ids = state.getWorkspaceDatabaseIds();
  if (!ids.sprintDbId) {
    throw new Error(
      "Sprint Board database is not configured. Ask maintainer to finish onboarding first."
    );
  }
  return ids;
}

async function createHeaders(state) {
  const token = await state.getNotionToken();
  if (!token) {
    throw new Error("Notion token not found. Run HelloDev onboarding first.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
  };
}

function safeText(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return "";
  }
  return value[0]?.plain_text || "";
}

async function listTasksForDeveloper(state, developerName) {
  const ids = requireWorkspaceConfig(state);
  const headers = await createHeaders(state);

  const url = `https://api.notion.com/v1/databases/${ids.sprintDbId}/query`;
  const body = {
    filter: {
      and: [
        { property: "Assigned To", rich_text: { equals: developerName } },
        { property: "Status", select: { does_not_equal: "Done" } }
      ]
    }
  };

  const response = await axios.post(url, body, { headers });
  return (response.data.results || []).map((page) => ({
    pageId: page.id,
    id: safeText(page.properties?.["Bug/Feature ID"]?.rich_text) || "N/A",
    name: safeText(page.properties?.["Task Name"]?.title) || "Untitled",
    status: page.properties?.Status?.select?.name || "Unknown",
    priority: page.properties?.Priority?.select?.name || "Unknown",
    points: page.properties?.["Story Points"]?.number || 0
  }));
}

async function startTaskForDeveloper(state, task, developerName) {
  const ids = requireWorkspaceConfig(state);
  if (!ids.logsDbId) {
    throw new Error(
      "Activity Logs database is not configured. Ask maintainer to run onboarding setup."
    );
  }
  const headers = await createHeaders(state);
  const now = new Date().toISOString();

  const taskUpdateUrl = `https://api.notion.com/v1/pages/${task.pageId}`;
  await axios.patch(
    taskUpdateUrl,
    {
      properties: {
        Status: { select: { name: "In Progress" } }
      }
    },
    { headers }
  );

  const logTitle = `${developerName} - ${task.id} - ${new Date().toLocaleDateString()}`;
  const logCreateUrl = "https://api.notion.com/v1/pages";
  const logResponse = await axios.post(
    logCreateUrl,
    {
      parent: { database_id: ids.logsDbId },
      properties: {
        "Log Title": { title: [{ text: { content: logTitle } }] },
        Developer: { rich_text: [{ text: { content: developerName } }] },
        "Task (Linked)": { relation: [{ id: task.pageId }] },
        "Session Start": { date: { start: now } },
        Status: { select: { name: "Active" } }
      }
    },
    { headers }
  );

  return {
    taskPageId: task.pageId,
    taskId: task.id,
    taskName: task.name,
    developerName,
    logId: logResponse.data.id,
    startedAt: now
  };
}

function computeHours(startedAtIso) {
  const startedAt = new Date(startedAtIso).getTime();
  if (!startedAt) {
    return 0;
  }
  const elapsedMs = Math.max(Date.now() - startedAt, 0);
  return elapsedMs / (1000 * 60 * 60);
}

async function syncActiveLogStats(state, activeSession) {
  const headers = await createHeaders(state);
  const url = `https://api.notion.com/v1/pages/${activeSession.logId}`;
  await axios.patch(
    url,
    {
      properties: {
        "Commits Count": { number: activeSession.commits.length },
        "Commit Messages": {
          rich_text: [{ text: { content: activeSession.commits.join(" | ").slice(0, 1900) || "No commits" } }]
        },
        "Files Changed": { number: activeSession.filesChanged || 0 },
        "Lines Added": { number: activeSession.linesAdded || 0 },
        "Lines Removed": { number: activeSession.linesRemoved || 0 }
      }
    },
    { headers }
  );
}

async function completeTaskForDeveloper(state, activeSession) {
  const headers = await createHeaders(state);
  const hours = Number(computeHours(activeSession.startedAt).toFixed(2));

  const taskUrl = `https://api.notion.com/v1/pages/${activeSession.taskPageId}`;
  await axios.patch(
    taskUrl,
    {
      properties: {
        Status: { select: { name: "Done" } }
      }
    },
    { headers }
  );

  const logUrl = `https://api.notion.com/v1/pages/${activeSession.logId}`;
  await axios.patch(
    logUrl,
    {
      properties: {
        "Session End": { date: { start: new Date().toISOString() } },
        "Total Time (hrs)": { number: hours },
        "Commits Count": { number: activeSession.commits.length },
        "Commit Messages": {
          rich_text: [{ text: { content: activeSession.commits.join(" | ").slice(0, 1900) || "No commits" } }]
        },
        "Files Changed": { number: activeSession.filesChanged || 0 },
        "Lines Added": { number: activeSession.linesAdded || 0 },
        "Lines Removed": { number: activeSession.linesRemoved || 0 },
        Status: { select: { name: "Completed" } }
      }
    },
    { headers }
  );

  return { hours };
}

module.exports = {
  listTasksForDeveloper,
  startTaskForDeveloper,
  syncActiveLogStats,
  completeTaskForDeveloper
};
