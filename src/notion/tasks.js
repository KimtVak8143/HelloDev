// Task CRUD Ops

const notion = require("./client");

// Mark task In Progress + create log sheet
async function startTask(bugId, developerName) {
  // 1. Find task by Bug ID
  const res = await notion.databases.query({
    database_id: process.env.SPRINT_DB_ID,
    filter: { property: "Bug/Feature ID", rich_text: { equals: bugId } }
  });

  const task = res.results[0];
  if (!task) throw new Error(`Task ${bugId} not found`);

  // 2. Update status to In Progress
  await notion.pages.update({
    page_id: task.id,
    properties: { Status: { select: { name: "In Progress" } } }
  });

  // 3. Create a linked log sheet
  const log = await notion.pages.create({
    parent: { database_id: process.env.LOGS_DB_ID },
    properties: {
      "Log Title": { title: [{ text: { content: `${developerName} - ${bugId}` } }] },
      "Developer": { rich_text: [{ text: { content: developerName } }] },
      "Session Start": { date: { start: new Date().toISOString() } },
      "Task": { relation: [{ id: task.id }] }
    }
  });

  return { taskId: task.id, logId: log.id };
}

// Mark task Done + seal log sheet
async function completeTask(bugId, logId, stats) {
  const res = await notion.databases.query({
    database_id: process.env.SPRINT_DB_ID,
    filter: { property: "Bug/Feature ID", rich_text: { equals: bugId } }
  });

  const task = res.results[0];

  await notion.pages.update({
    page_id: task.id,
    properties: { Status: { select: { name: "Done" } } }
  });

  await notion.pages.update({
    page_id: logId,
    properties: {
      "Session End": { date: { start: new Date().toISOString() } },
      "Total Time (hrs)": { number: stats.hours },
      "Commits": { number: stats.commits },
      "Commit Messages": { rich_text: [{ text: { content: stats.messages.join(", ") } }] }
    }
  });
}

module.exports = { startTask, completeTask };