#!/usr/bin/env node
// ─── HelloDev CLI ───────────────────────────────────────────────────────────
// Usage:
//   hellodev start bug-#1 --dev Alice
//   hellodev done bug-#1
//   hellodev status
//   hellodev tasks Alice

const axios = require("axios");
require("dotenv").config();

const BASE = `http://localhost:${process.env.PORT || 3333}`;
const args = process.argv.slice(2);
const action = args[0];

const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`
};

(async () => {
  try {
    // ── hellodev start bug-#1 --dev Alice ──
    if (action === "start") {
      const bugId = args[1];
      const devIndex = args.indexOf("--dev");
      const developer = devIndex !== -1 ? args[devIndex + 1] : null;

      if (!bugId || !developer) {
        console.log(colors.red("Usage: hellodev start <bug-id> --dev <developer-name>"));
        process.exit(1);
      }

      const { data } = await axios.post(`${BASE}/start`, { bugId, developer });
      console.log(colors.green(`\n${data.message}`));
      console.log(colors.cyan(`Log ID: ${data.logId}\n`));
    }

    // ── hellodev done bug-#1 ──
    else if (action === "done") {
      const bugId = args[1];

      if (!bugId) {
        console.log(colors.red("Usage: hellodev done <bug-id>"));
        process.exit(1);
      }

      const { data } = await axios.post(`${BASE}/done`, { bugId });
      console.log(colors.green(`\n${data.message}`));
      console.log(colors.cyan(`⏱  Time: ${data.totalTime} | Commits: ${data.commits}\n`));
    }

    // ── hellodev status ──
    else if (action === "status") {
      const { data } = await axios.get(`${BASE}/status`);

      if (!data.active) {
        console.log(colors.yellow("\n💤 No active task session\n"));
      } else {
        console.log(colors.bold("\n📊 Active Session:"));
        console.log(`  Task     : ${colors.cyan(data.bugId)}`);
        console.log(`  Developer: ${data.developer}`);
        console.log(`  Elapsed  : ${colors.yellow(data.elapsed)}`);
        console.log(`  Commits  : ${data.commits}`);
        if (data.commitMessages.length) {
          console.log(`  Messages : ${data.commitMessages.join(", ")}`);
        }
        console.log();
      }
    }

    // ── hellodev tasks Alice ──
    else if (action === "tasks") {
      const developer = args[1];

      if (!developer) {
        console.log(colors.red("Usage: hellodev tasks <developer-name>"));
        process.exit(1);
      }

      const { data } = await axios.get(`${BASE}/tasks/${developer}`);
      console.log(colors.bold(`\n📋 Tasks for ${developer}:`));

      if (!data.tasks.length) {
        console.log(colors.green("  ✅ All tasks complete!\n"));
      } else {
        data.tasks.forEach((t) => {
          const statusColor = t.status === "In Progress" ? colors.yellow : colors.cyan;
          console.log(`  [${statusColor(t.status)}] ${colors.bold(t.id)} — ${t.name} (${t.priority})`);
        });
        console.log();
      }
    }

    // ── Help ──
    else {
      console.log(colors.bold("\n🚀 HelloDev Tracker CLI"));
      console.log("─────────────────────────────────");
      console.log(`  ${colors.cyan("hellodev start <bug-id> --dev <name>")}  Start tracking a task`);
      console.log(`  ${colors.cyan("hellodev done <bug-id>")}                Mark task complete`);
      console.log(`  ${colors.cyan("hellodev status")}                       Show active session`);
      console.log(`  ${colors.cyan("hellodev tasks <developer-name>")}       View pending tasks\n`);
    }
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      console.log(colors.red("\n❌ HelloDev Server is not running!"));
      console.log(colors.yellow("   Start it with: node src/server.js\n"));
    } else {
      console.log(colors.red(`\n❌ Error: ${err.response?.data?.error || err.message}\n`));
    }
    process.exit(1);
  }
})();