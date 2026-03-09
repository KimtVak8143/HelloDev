const notion = require("./client");
require("dotenv").config();

// ─── Find task by Bug/Feature ID ───────────────────────────────────────────
async function findTask(bugId) {
  const res = await notion.databases.query({
    database_id: process.env.SPRINT_DB_ID,
    filter: {
      property: "Bug/Feature ID",
      rich_text: { equals: bugId },
    },
  });

  if (!res.results.length) throw new Error(`❌ Task "${bugId}" not found in Sprint Board.`);
  return res.results[0];
}

// ─── Start a task: mark In Progress + create log sheet ────────────────────
async function startTask(bugId, developerName) {
  const task = await findTask(bugId);

  // Update task status → In Progress
  await notion.pages.update({
    page_id: task.id,
    properties: {
      Status: { select: { name: "In Progress" } },
    },
  });

  // Create a new Activity Log entry linked to this task
  const log = await notion.pages.create({
    parent: { database_id: process.env.LOGS_DB_ID },
    properties: {
      "Log Title": {
        title: [{ text: { content: `${developerName} — ${bugId} — ${new Date().toLocaleDateString()}` } }],
      },
      Developer: {
        rich_text: [{ text: { content: developerName } }],
      },
      "Session Start": {
        date: { start: new Date().toISOString() },
      },
      Status: {
        select: { name: "Active" },
      },
      "Task (Linked)": {
        relation: [{ id: task.id }],
      },
    },
  });

  console.log(`\n✅ Task "${bugId}" → In Progress`);
  console.log(`📋 Log sheet created: ${log.id}\n`);

  return { taskId: task.id, logId: log.id };
}

// ─── Complete a task: mark Done + seal the log sheet ──────────────────────
async function completeTask(bugId, logId, stats) {
  const task = await findTask(bugId);

  // Update task status → Done
  await notion.pages.update({
    page_id: task.id,
    properties: {
      Status: { select: { name: "Done" } },
    },
  });

  // Seal the log sheet with final stats
  await notion.pages.update({
    page_id: logId,
    properties: {
      "Session End": {
        date: { start: new Date().toISOString() },
      },
      "Total Time (hrs)": {
        number: parseFloat(stats.hours.toFixed(2)),
      },
      "Commits Count": {
        number: stats.commits,
      },
      "Commit Messages": {
        rich_text: [{ text: { content: stats.messages.join(" | ") || "No commits recorded" } }],
      },
      Status: {
        select: { name: "Completed" },
      },
    },
  });

  console.log(`\n🎉 Task "${bugId}" → Done`);
  console.log(`⏱  Time: ${stats.hours.toFixed(2)} hrs | Commits: ${stats.commits}\n`);
}

// ─── Get all tasks assigned to a developer ────────────────────────────────
async function getMyTasks(developerName) {
  const res = await notion.databases.query({
    database_id: process.env.SPRINT_DB_ID,
    filter: {
      and: [
        { property: "Assigned To", rich_text: { equals: developerName } },
        { property: "Status", select: { does_not_equal: "Done" } },
      ],
    },
  });

  return res.results.map((page) => ({
    id: page.properties["Bug/Feature ID"]?.rich_text[0]?.text?.content || "N/A",
    name: page.properties["Task Name"]?.title[0]?.text?.content || "Untitled",
    status: page.properties["Status"]?.select?.name || "Unknown",
    priority: page.properties["Priority"]?.select?.name || "Unknown",
    sprint: page.properties["Sprint"]?.select?.name || "Unknown",
  }));
}

module.exports = { startTask, completeTask, findTask, getMyTasks };