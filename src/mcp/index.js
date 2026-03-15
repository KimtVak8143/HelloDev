"use strict";

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const {
  getMyTasks,
  startTask,
  getStatus,
  completeTask,
  getSprint,
  logCommit,
  generateStandup
} = require("../runtime/actions");

function text(message) {
  return { content: [{ type: "text", text: message }] };
}

function formatTasks(identity, tasks) {
  if (!tasks.length) {
    return `No pending tasks for ${identity.name}.`;
  }
  return tasks
    .map(
      (task, index) =>
        `${index + 1}. [${task.status}] ${task.id} - ${task.name} (${task.priority}, ${task.points} pts)`
    )
    .join("\n");
}

function createMcpServer(state, output) {
  const server = new McpServer({
    name: "hellodev-tracker",
    version: "1.0.0"
  });

  server.tool("list_tasks", "List pending tasks assigned to current developer.", {}, async () => {
    try {
      const { identity, tasks } = await getMyTasks(state);
      return text(`Tasks for ${identity.name}:\n${formatTasks(identity, tasks)}`);
    } catch (error) {
      return text(`Error: ${error.message}`);
    }
  });

  server.tool(
    "start_task",
    "Start a task by bug/feature id assigned to current developer.",
    { bug_id: z.string().describe("Bug or feature id, e.g. bug-#1") },
    async ({ bug_id }) => {
      try {
        const { tasks } = await getMyTasks(state);
        const task = tasks.find((item) => item.id === bug_id);
        if (!task) {
          return text(`Task not found for current developer: ${bug_id}`);
        }

        const session = await startTask(state, task);
        return text(`Started ${session.taskId}: ${session.taskName}`);
      } catch (error) {
        return text(`Error: ${error.message}`);
      }
    }
  );

  server.tool("get_status", "Get current active session status.", {}, async () => {
    const status = getStatus(state);
    if (!status.active) {
      return text("No active session running.");
    }
    return text(
      `Active: ${status.taskId} (${status.taskName}) | ${status.elapsed} | ${status.commits} commits`
    );
  });

  server.tool("complete_task", "Complete current active task.", {}, async () => {
    try {
      const { active, result } = await completeTask(state);
      return text(`Completed ${active.taskId}: ${active.taskName} (${result.hours} hrs)`);
    } catch (error) {
      return text(`Error: ${error.message}`);
    }
  });

  server.tool("get_sprint", "Get sprint board grouped by status.", {}, async () => {
    try {
      const board = await getSprint(state);
      const lines = Object.entries(board).map(([status, items]) => {
        return `${status}: ${items.length}`;
      });
      return text(`Sprint board summary:\n${lines.join("\n")}`);
    } catch (error) {
      return text(`Error: ${error.message}`);
    }
  });

  server.tool(
    "log_commit",
    "Log commit stats into active session and Notion activity log.",
    {
      message: z.string().describe("Commit message"),
      files_changed: z.number().optional(),
      lines_added: z.number().optional(),
      lines_removed: z.number().optional()
    },
    async ({ message, files_changed, lines_added, lines_removed }) => {
      try {
        const result = await logCommit(state, {
          message,
          filesChanged: files_changed || 0,
          linesAdded: lines_added || 0,
          linesRemoved: lines_removed || 0
        });
        return text(`Commit logged. Total commits in session: ${result.commits}`);
      } catch (error) {
        return text(`Error: ${error.message}`);
      }
    }
  );

  server.tool("generate_standup", "Generate last-24h standup summary.", {}, async () => {
    try {
      const report = await generateStandup(state);
      return text(report);
    } catch (error) {
      return text(`Error: ${error.message}`);
    }
  });

  output.info(
    "MCP tools registered: list_tasks, start_task, get_status, complete_task, get_sprint, log_commit, generate_standup"
  );
  return server;
}

async function startStdioMcpServer(state, output) {
  const server = createMcpServer(state, output);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return { server, transport };
}

module.exports = {
  createMcpServer,
  startStdioMcpServer
};
