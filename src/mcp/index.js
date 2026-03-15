#!/usr/bin/env node
// ─── HelloDev MCP Server ───────────────────────────────────────────────────────────
// Exposes HelloDev Sprint Tracker as MCP tools for Copilot / Claude in VSCode
// Developer can chat naturally instead of memorizing CLI commands
//
// Tools exposed:
//   • list_tasks      — "What are my tasks?"
//   • start_task      — "Start working on bug-#1"
//   • complete_task   — "I'm done with bug-#1"
//   • get_status      — "How long have I been working?"
//   • get_sprint      — "Show me the full sprint board"

require("dotenv").config();
const { McpServer }    = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z }            = require("zod");
const axios            = require("axios");

const BASE = `http://localhost:${process.env.PORT || 3333}`;

// ─── Helper: call HelloDev Express server ─────────────────────────────────────────
async function callHelloDev(method, path, body = null) {
  try {
    const res = method === "get"
      ? await axios.get(`${BASE}${path}`)
      : await axios.post(`${BASE}${path}`, body);
    return { ok: true, data: res.data };
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    if (err.code === "ECONNREFUSED") {
      return { ok: false, error: "HelloDev server is not running. Please start it with: npm run dev" };
    }
    return { ok: false, error: msg };
  }
}

function text(content) {
  return { content: [{ type: "text", text: content }] };
}

// ─── Create MCP Server ────────────────────────────────────────────────────────
const server = new McpServer({
  name:    "HelloDev-tracker",
  version: "1.0.0"
});

// ─── TOOL: list_tasks ─────────────────────────────────────────────────────────
server.tool(
  "list_tasks",
  "List all pending tasks assigned to a developer from the Notion Sprint Board",
  {
    developer: z.string().describe("Developer name e.g. Alice, Bob")
  },
  async ({ developer }) => {
    const result = await callHelloDev("get", `/tasks/${developer}`);
    if (!result.ok) {return text(`❌ ${result.error}`);}

    const { tasks } = result.data;
    if (!tasks.length) {return text(`✅ No pending tasks for ${developer}. Sprint board is clear!`);}

    const lines = tasks.map((t, i) =>
      `  ${i + 1}. [${t.status}] ${t.id} — ${t.name}\n     Priority: ${t.priority} | Story Points: ${t.points}`
    ).join("\n");

    return text(`📋 Tasks for ${developer}:\n\n${lines}\n\nRun start_task to begin working on one.`);
  }
);

// ─── TOOL: start_task ─────────────────────────────────────────────────────────
server.tool(
  "start_task",
  "Start tracking a task — marks it In Progress in Notion and starts the activity log",
  {
    bug_id:    z.string().describe("Bug or Feature ID e.g. bug-#1, feature-#2"),
    developer: z.string().describe("Developer name e.g. Alice")
  },
  async ({ bug_id, developer }) => {
    const result = await callHelloDev("post", "/start", { bugId: bug_id, developer });
    if (!result.ok) {return text(`❌ ${result.error}`);}

    const { taskName, logId, startedAt } = result.data;
    return text(
      "🚀 Session started!\n\n" +
      `  Task:      ${taskName} (${bug_id})\n` +
      `  Developer: ${developer}\n` +
      `  Started:   ${new Date(startedAt).toLocaleTimeString()}\n` +
      `  Log ID:    ${logId}\n\n` +
      "Notion updated → In Progress ✅\n" +
      "Timer running in background ⏱️\n\n" +
      "Git commits will be auto-logged. Run complete_task when done."
    );
  }
);

// ─── TOOL: complete_task ──────────────────────────────────────────────────────
server.tool(
  "complete_task",
  "Complete the active task — marks it Done in Notion and seals the activity log with stats",
  {
    bug_id: z.string().describe("Bug or Feature ID e.g. bug-#1")
  },
  async ({ bug_id }) => {
    const result = await callHelloDev("post", "/done", { bugId: bug_id });
    if (!result.ok) {return text(`❌ ${result.error}`);}

    const { taskName, developer, totalHrs, commits, filesChanged, linesAdded, linesRemoved } = result.data;
    return text(
      "🎉 Task Complete!\n\n" +
      `  Task:          ${taskName} (${bug_id})\n` +
      `  Developer:     ${developer}\n\n` +
      "📊 Session Stats:\n" +
      `  ⏱️  Time:         ${totalHrs} hrs\n` +
      `  📝 Commits:      ${commits}\n` +
      `  📁 Files Changed: ${filesChanged}\n` +
      `  ➕ Lines Added:   ${linesAdded}\n` +
      `  ➖ Lines Removed: ${linesRemoved}\n\n` +
      "Notion updated → Done ✅\n" +
      "Activity Log sealed and linked to task ✅"
    );
  }
);

// ─── TOOL: get_status ─────────────────────────────────────────────────────────
server.tool(
  "get_status",
  "Get the current active session — elapsed time, commits, which task is being worked on",
  {},
  async () => {
    const result = await callHelloDev("get", "/status");
    if (!result.ok) {return text(`❌ ${result.error}`);}

    const data = result.data;
    if (!data.active) {
      return text("💤 No active session running.\n\nUse list_tasks to see what's available, then start_task to begin.");
    }

    return text(
      "⚡ Active Session\n\n" +
      `  Task:      ${data.taskName} (${data.bugId})\n` +
      `  Developer: ${data.developer}\n` +
      `  Elapsed:   ${data.elapsed}\n` +
      `  Commits:   ${data.commits}\n\n` +
      "Keep going! Run complete_task when you're done."
    );
  }
);

// ─── TOOL: get_sprint ─────────────────────────────────────────────────────────
server.tool(
  "get_sprint",
  "Get a full overview of the current sprint — all tasks and their statuses",
  {
    developer: z.string().optional().describe("Filter by developer name (optional)")
  },
  async ({ developer }) => {
    const result = await callHelloDev("get", "/");
    if (!result.ok) {return text(`❌ ${result.error}`);}

    // Also get tasks if developer provided
    if (developer) {
      const tasks = await callHelloDev("get", `/tasks/${developer}`);
      if (!tasks.ok) {return text(`❌ ${tasks.error}`);}

      const list = tasks.data.tasks;
      if (!list.length) {return text(`✅ ${developer} has no pending tasks!`);}

      const lines = list.map(t =>
        `  [${t.status.padEnd(11)}] ${t.id.padEnd(12)} ${t.name} (${t.priority})`
      ).join("\n");

      return text(`📋 Sprint Overview for ${developer}:\n\n${lines}`);
    }

    const session = result.data.session;
    return text(
      "🚀 HelloDev Sprint Tracker\n\n" +
      `Server: Running on port ${process.env.PORT || 3333}\n\n` +
      (session
        ? `Active Session:\n  ${session.developer} → ${session.bugId} | ${session.elapsed} | ${session.commits} commits`
        : "No active session. Use list_tasks to get started."
      )
    );
  }
);

// ─── Start MCP Server ─────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ HelloDev MCP Server running — waiting for tool calls...");
}

main().catch(err => {
  console.error("❌ MCP Server error:", err);
  process.exit(1);
});