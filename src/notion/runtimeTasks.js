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
    id: safeText(page.properties?.["Bug/Feature ID"]?.rich_text) || "N/A",
    name: safeText(page.properties?.["Task Name"]?.title) || "Untitled",
    status: page.properties?.Status?.select?.name || "Unknown",
    priority: page.properties?.Priority?.select?.name || "Unknown",
    points: page.properties?.["Story Points"]?.number || 0
  }));
}

module.exports = {
  listTasksForDeveloper
};
