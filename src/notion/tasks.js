const notion = require("./client");
const logger = require("../utils/logger");
const axios = require("axios");
require("dotenv").config();

const SPRINT_DB_ID = process.env.SPRINT_DB_ID;
const LOGS_DB_ID = process.env.LOGS_DB_ID;

// Helper: perform a database query via HTTP directly. The official SDK has
// an unexplained bug where using notion.request({path: ...}) produces a
// spurious "invalid_request_url" error, so we bypass it. The implementation
// mirrors the curl command used during troubleshooting.
async function notionQuery(databaseId, body = {}) {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    }
  });
  return response.data;
}

async function findTask(bugId) {
  logger.notion("Querying Sprint Board", { bugId });
  // perform a direct HTTP query using the axios helper.
  const res = await notionQuery(SPRINT_DB_ID, {
    filter: { property: "Bug/Feature ID", rich_text: { equals: bugId } }
  });
  if (!res.results.length) {
    throw new Error(`Task "${bugId}" not found in Sprint Board.`);
  }
  const task = res.results[0];
  logger.notion("Task found", {
    bugId,
    taskName: task.properties["Task Name"].title[0]?.plain_text,
    pageId: task.id
  });
  return task;
}

async function startTask(bugId, developerName) {
  logger.section(`Starting Task: ${bugId}`);
  const task = await findTask(bugId);
  const taskName = task.properties["Task Name"].title[0]?.plain_text || bugId;

  logger.notion("Updating status → In Progress", { pageId: task.id });
  await notion.pages.update({
    page_id: task.id,
    properties: { Status: { select: { name: "In Progress" } } }
  });
  logger.success(`Task "${taskName}" marked In Progress`);

  const now = new Date().toISOString();
  const logTitle = `${developerName} — ${bugId} — ${new Date().toLocaleDateString()}`;
  logger.notion("Creating Activity Log Sheet", { logTitle });

  const log = await notion.pages.create({
    parent: { database_id: LOGS_DB_ID },
    properties: {
      "Log Title": { title: [{ text: { content: logTitle } }] },
      Developer: { rich_text: [{ text: { content: developerName } }] },
      "Session Start": { date: { start: now } },
      Status: { select: { name: "Active" } },
      "Task (Linked)": { relation: [{ id: task.id }] }
    }
  });
  logger.success("Log Sheet created", { logId: log.id });

  await notion.pages.update({
    page_id: task.id,
    properties: { "Log Sheet": { relation: [{ id: log.id }] } }
  });
  logger.success(`Session started — ${developerName} on ${bugId}`);
  return { taskId: task.id, taskName, logId: log.id };
}

async function completeTask(bugId, logId, stats) {
  logger.section(`Completing Task: ${bugId}`);
  const task = await findTask(bugId);
  const taskName = task.properties["Task Name"].title[0]?.plain_text || bugId;

  logger.notion("Updating status → Done", { pageId: task.id });
  await notion.pages.update({
    page_id: task.id,
    properties: { Status: { select: { name: "Done" } } }
  });
  logger.success(`Task "${taskName}" marked Done`);

  logger.notion("Sealing Log Sheet", {
    logId,
    hours: stats.hours.toFixed(2),
    commits: stats.commits
  });
  await notion.pages.update({
    page_id: logId,
    properties: {
      "Session End": { date: { start: new Date().toISOString() } },
      "Total Time (hrs)": { number: parseFloat(stats.hours.toFixed(2)) },
      "Commits Count": { number: stats.commits },
      "Commit Messages": {
        rich_text: [{ text: { content: stats.messages.join(" | ") || "No commits" } }]
      },
      "Files Changed": { number: stats.filesChanged || 0 },
      "Lines Added": { number: stats.linesAdded || 0 },
      "Lines Removed": { number: stats.linesRemoved || 0 },
      Status: { select: { name: "Completed" } }
    }
  });
  logger.success("Log Sheet sealed", { totalHrs: stats.hours.toFixed(2), commits: stats.commits });
  return { taskId: task.id, taskName };
}

async function listTasks(developerName) {
  logger.notion("Fetching tasks", { developer: developerName });
  const res = await notionQuery(SPRINT_DB_ID, {
    filter: {
      and: [
        { property: "Assigned To", rich_text: { equals: developerName } },
        { property: "Status", select: { does_not_equal: "Done" } }
      ]
    }
  });
  const tasks = res.results.map((page) => ({
    id: page.properties["Bug/Feature ID"].rich_text[0]?.plain_text || "N/A",
    name: page.properties["Task Name"].title[0]?.plain_text || "Untitled",
    status: page.properties["Status"].select?.name || "Unknown",
    priority: page.properties["Priority"].select?.name || "Unknown",
    points: page.properties["Story Points"].number || 0
  }));
  logger.info(`Found ${tasks.length} pending task(s) for ${developerName}`);
  return tasks;
}

module.exports = { startTask, completeTask, listTasks, findTask };
