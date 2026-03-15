"use strict";

const vscode = require("vscode");
const { Client } = require("@notionhq/client");

function title(content) {
  return [{ type: "text", text: { content } }];
}

async function askParentPageId() {
  return vscode.window.showInputBox({
    title: "HelloDev Notion Parent Page ID",
    prompt: "Paste parent page ID where HelloDev databases should be created",
    placeHolder: "Example: 1234567890abcdef1234567890abcdef",
    ignoreFocusOut: true,
    validateInput(input) {
      if (!input || !input.trim()) {
        return "Parent page ID is required.";
      }
      const cleaned = input.trim().replace(/-/g, "");
      if (!/^[a-fA-F0-9]{32}$/.test(cleaned)) {
        return "Enter a valid Notion page ID (32 hex chars, dashes optional).";
      }
      return null;
    }
  });
}

function sanitizePageId(raw) {
  return raw.trim().replace(/-/g, "");
}

async function createLogsDatabase(notion, parentPageId) {
  return notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: title("Activity Logs"),
    properties: {
      "Log Title": { title: {} },
      "Developer": { rich_text: {} },
      "Session Start": { date: {} },
      "Session End": { date: {} },
      "Total Time (hrs)": { number: { format: "number" } },
      "Commits Count": { number: { format: "number" } },
      "Commit Messages": { rich_text: {} },
      "Files Changed": { number: { format: "number" } },
      "Lines Added": { number: { format: "number" } },
      "Lines Removed": { number: { format: "number" } },
      "Status": {
        select: {
          options: [{ name: "Active" }, { name: "Completed" }]
        }
      }
    }
  });
}

async function createSprintDatabase(notion, parentPageId, logsDbId) {
  return notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: title("Sprint Board"),
    properties: {
      "Task Name": { title: {} },
      "Bug/Feature ID": { rich_text: {} },
      "Status": {
        select: {
          options: [
            { name: "Todo" },
            { name: "In Progress" },
            { name: "Done" },
            { name: "Blocked" }
          ]
        }
      },
      "Priority": {
        select: { options: [{ name: "High" }, { name: "Medium" }, { name: "Low" }] }
      },
      "Assigned To": { rich_text: {} },
      "Sprint": {
        select: { options: [{ name: "Sprint 1" }, { name: "Sprint 2" }, { name: "Sprint 3" }] }
      },
      "Task Type": {
        select: {
          options: [{ name: "Bug" }, { name: "Feature" }, { name: "Chore" }, { name: "Review" }]
        }
      },
      "Story Points": { number: { format: "number" } },
      "Log Sheet": { relation: { database_id: logsDbId } }
    }
  });
}

async function addLogsRelationToSprint(notion, logsDbId, sprintDbId) {
  await notion.databases.update({
    database_id: logsDbId,
    properties: {
      "Task (Linked)": { relation: { database_id: sprintDbId } }
    }
  });
}

async function createDevelopersDatabase(notion, parentPageId) {
  return notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: title("Developers"),
    properties: {
      Name: { title: {} },
      Email: { email: {} },
      Role: { select: { options: [{ name: "Maintainer" }, { name: "Developer" }] } }
    }
  });
}

async function setupMaintainerWorkspace(state, output) {
  const token = await state.getNotionToken();
  if (!token) {
    throw new Error("Notion token missing. Re-run onboarding and provide token.");
  }

  const parentPageRaw = await askParentPageId();
  if (!parentPageRaw) {
    return { created: false, reason: "cancelled" };
  }
  const parentPageId = sanitizePageId(parentPageRaw);

  const notion = new Client({ auth: token });
  output.info("Creating HelloDev Notion databases for maintainer");

  const logsDb = await createLogsDatabase(notion, parentPageId);
  const sprintDb = await createSprintDatabase(notion, parentPageId, logsDb.id);
  await addLogsRelationToSprint(notion, logsDb.id, sprintDb.id);
  const devsDb = await createDevelopersDatabase(notion, parentPageId);

  await state.setWorkspaceDatabaseIds({
    sprintDbId: sprintDb.id,
    logsDbId: logsDb.id,
    devsDbId: devsDb.id
  });

  output.info("Maintainer workspace setup complete");
  return {
    created: true,
    sprintDbId: sprintDb.id,
    logsDbId: logsDb.id,
    devsDbId: devsDb.id
  };
}

module.exports = {
  setupMaintainerWorkspace
};
