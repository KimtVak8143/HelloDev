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

function getDatabaseTitle(database) {
  const parts = Array.isArray(database.title) ? database.title : [];
  return parts
    .map((part) => part.plain_text || "")
    .join("")
    .trim();
}

async function findDatabaseByTitle(notion, parentPageId, wantedTitle) {
  const matches = [];
  let cursor = undefined;
  do {
    const response = await notion.search({
      query: wantedTitle,
      filter: { property: "object", value: "database" },
      start_cursor: cursor
    });

    const pageMatches = response.results.filter((result) => {
      if (result.object !== "database") {
        return false;
      }
      if (result.parent?.type !== "page_id") {
        return false;
      }
      return (
        result.parent.page_id === parentPageId &&
        getDatabaseTitle(result).toLowerCase() === wantedTitle.toLowerCase()
      );
    });

    matches.push(...pageMatches);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return matches;
}

async function createLogsDatabase(notion, parentPageId) {
  return notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: title("Activity Logs"),
    properties: {
      "Log Title": { title: {} },
      Developer: { rich_text: {} },
      "Session Start": { date: {} },
      "Session End": { date: {} },
      "Total Time (hrs)": { number: { format: "number" } },
      "Commits Count": { number: { format: "number" } },
      "Commit Messages": { rich_text: {} },
      "Files Changed": { number: { format: "number" } },
      "Lines Added": { number: { format: "number" } },
      "Lines Removed": { number: { format: "number" } },
      Status: {
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
      Status: {
        select: {
          options: [
            { name: "Todo" },
            { name: "In Progress" },
            { name: "Done" },
            { name: "Blocked" }
          ]
        }
      },
      Priority: {
        select: { options: [{ name: "High" }, { name: "Medium" }, { name: "Low" }] }
      },
      "Assigned To": { rich_text: {} },
      Sprint: {
        select: { options: [{ name: "Sprint 1" }, { name: "Sprint 2" }, { name: "Sprint 3" }] }
      },
      "Task Type": {
        select: {
          options: [{ name: "Bug" }, { name: "Feature" }, { name: "Chore" }, { name: "Review" }]
        }
      },
      "Story Points": { number: { format: "number" } },
      "Log Sheet": {
        relation: {
          database_id: logsDbId,
          single_property: {}
        }
      }
    }
  });
}

async function addLogsRelationToSprint(notion, logsDbId, sprintDbId) {
  await notion.databases.update({
    database_id: logsDbId,
    properties: {
      "Task (Linked)": {
        relation: {
          database_id: sprintDbId,
          single_property: {}
        }
      }
    }
  });
}

async function ensureSprintLogsRelation(notion, sprintDbId, logsDbId) {
  await notion.databases.update({
    database_id: sprintDbId,
    properties: {
      "Log Sheet": {
        relation: {
          database_id: logsDbId,
          single_property: {}
        }
      }
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

async function archiveDatabase(notion, databaseId, output) {
  try {
    await notion.databases.update({
      database_id: databaseId,
      archived: true
    });
    output.warn(`Rolled back database ${databaseId}`);
  } catch (error) {
    output.error(`Rollback failed for ${databaseId}: ${error.message}`);
  }
}

async function getOrCreateDatabase(notion, output, parentPageId, name, createFn, createdIds) {
  const existing = await findDatabaseByTitle(notion, parentPageId, name);
  if (existing.length > 1) {
    const ids = existing.map((db) => db.id).join(", ");
    throw new Error(
      `Multiple "${name}" databases found under parent page. Please keep one and archive others. IDs: ${ids}`
    );
  }
  if (existing.length === 1) {
    output.info(`Reusing existing database: ${name}`);
    return { db: existing[0], created: false };
  }

  const created = await createFn();
  output.info(`Created database: ${name}`);
  createdIds.push(created.id);
  return { db: created, created: true };
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
  const createdIds = [];
  output.info("Preparing HelloDev Notion databases for maintainer");

  try {
    const logs = await getOrCreateDatabase(
      notion,
      output,
      parentPageId,
      "Activity Logs",
      () => createLogsDatabase(notion, parentPageId),
      createdIds
    );
    const sprint = await getOrCreateDatabase(
      notion,
      output,
      parentPageId,
      "Sprint Board",
      () => createSprintDatabase(notion, parentPageId, logs.db.id),
      createdIds
    );
    const devs = await getOrCreateDatabase(
      notion,
      output,
      parentPageId,
      "Developers",
      () => createDevelopersDatabase(notion, parentPageId),
      createdIds
    );

    await ensureSprintLogsRelation(notion, sprint.db.id, logs.db.id);
    await addLogsRelationToSprint(notion, logs.db.id, sprint.db.id);

    await state.setWorkspaceDatabaseIds({
      sprintDbId: sprint.db.id,
      logsDbId: logs.db.id,
      devsDbId: devs.db.id
    });

    output.info("Maintainer workspace setup complete");
    return {
      created: logs.created || sprint.created || devs.created,
      reused: !(logs.created || sprint.created || devs.created),
      sprintDbId: sprint.db.id,
      logsDbId: logs.db.id,
      devsDbId: devs.db.id
    };
  } catch (error) {
    output.error(`Maintainer setup failed. Rolling back: ${error.message}`);
    for (const databaseId of createdIds.reverse()) {
      await archiveDatabase(notion, databaseId, output);
    }
    throw error;
  }
}

module.exports = {
  setupMaintainerWorkspace
};
