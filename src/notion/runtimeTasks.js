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

async function queryDatabase(state, databaseId, body) {
  const headers = await createHeaders(state);
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const response = await axios.post(url, body || {}, { headers });
  return response.data.results || [];
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

async function listSprintBoard(state) {
  const ids = requireWorkspaceConfig(state);
  const pages = await queryDatabase(state, ids.sprintDbId, {});
  const grouped = {
    Todo: [],
    "In Progress": [],
    Done: [],
    Blocked: [],
    Unknown: []
  };

  for (const page of pages) {
    const task = {
      id: safeText(page.properties?.["Bug/Feature ID"]?.rich_text) || "N/A",
      name: safeText(page.properties?.["Task Name"]?.title) || "Untitled",
      status: page.properties?.Status?.select?.name || "Unknown",
      assignedTo: safeText(page.properties?.["Assigned To"]?.rich_text) || "Unassigned",
      priority: page.properties?.Priority?.select?.name || "Unknown"
    };

    if (!grouped[task.status]) {
      grouped.Unknown.push(task);
    } else {
      grouped[task.status].push(task);
    }
  }

  return grouped;
}

async function upsertDeveloper(state, identity, role) {
  const ids = state.getWorkspaceDatabaseIds();
  if (!ids.devsDbId) {
    return { upserted: false, reason: "missing_devs_db" };
  }

  const pages = await queryDatabase(state, ids.devsDbId, {
    filter: {
      property: "Email",
      email: { equals: identity.email || "" }
    }
  });

  const headers = await createHeaders(state);
  if (pages.length > 0) {
    const existing = pages[0];
    await axios.patch(
      `https://api.notion.com/v1/pages/${existing.id}`,
      {
        properties: {
          Name: { title: [{ text: { content: identity.name || "Unknown" } }] },
          Email: { email: identity.email || null },
          Role: { select: { name: role === "maintainer" ? "Maintainer" : "Developer" } }
        }
      },
      { headers }
    );
    return { upserted: true, action: "updated", pageId: existing.id };
  }

  const created = await axios.post(
    "https://api.notion.com/v1/pages",
    {
      parent: { database_id: ids.devsDbId },
      properties: {
        Name: { title: [{ text: { content: identity.name || "Unknown" } }] },
        Email: { email: identity.email || null },
        Role: { select: { name: role === "maintainer" ? "Maintainer" : "Developer" } }
      }
    },
    { headers }
  );
  return { upserted: true, action: "created", pageId: created.data.id };
}

function getDateHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function generateStandupReport(state) {
  const ids = state.getWorkspaceDatabaseIds();
  if (!ids.logsDbId) {
    throw new Error("Activity Logs database is not configured.");
  }

  const logs = await queryDatabase(state, ids.logsDbId, {
    filter: {
      property: "Session Start",
      date: { on_or_after: getDateHoursAgo(24) }
    }
  });

  const byDev = {};
  for (const page of logs) {
    const developer = safeText(page.properties?.Developer?.rich_text) || "Unknown";
    const commits = page.properties?.["Commits Count"]?.number || 0;
    const hours = page.properties?.["Total Time (hrs)"]?.number || 0;
    const status = page.properties?.Status?.select?.name || "Unknown";
    if (!byDev[developer]) {
      byDev[developer] = { hours: 0, commits: 0, completed: 0, active: 0 };
    }
    byDev[developer].hours += hours;
    byDev[developer].commits += commits;
    if (status === "Completed") {
      byDev[developer].completed += 1;
    }
    if (status === "Active") {
      byDev[developer].active += 1;
    }
  }

  const lines = Object.entries(byDev).map(([dev, stats]) => {
    return `${dev}: ${stats.hours.toFixed(2)} hrs, ${stats.commits} commits, ${stats.completed} completed, ${stats.active} active`;
  });

  if (lines.length === 0) {
    return "Standup: no activity logs found in last 24 hours.";
  }
  return `Standup (last 24h)\n${lines.join("\n")}`;
}

module.exports = {
  listTasksForDeveloper,
  startTaskForDeveloper,
  syncActiveLogStats,
  completeTaskForDeveloper,
  listSprintBoard,
  upsertDeveloper,
  generateStandupReport
};
