"use strict";

const { createRuntimeState } = require("./runtime/state");
const { startMcpHost, stopMcpHost } = require("./mcp/host");
const { createOutput } = require("./utils/output");
const { registerHelloDevCommands } = require("./ui/commands");
const { loadSession } = require("./runtime/sessionStore");
const { startPendingCommitWatcher } = require("./trackers/fileWatcher");

let output;
let commitWatcher;

async function activate(context) {
  output = createOutput();
  output.info("Activating HelloDev extension runtime");

  const state = createRuntimeState(context);
  try {
    const restored = loadSession();
    if (restored) {
      state.setActiveSession(restored);
      output.info(`Restored active session: ${restored.taskId}`);
    }
  } catch (error) {
    output.warn(`Could not restore prior session: ${error.message}`);
  }

  registerHelloDevCommands(context, state, output);
  await startMcpHost(state, output);
  commitWatcher = startPendingCommitWatcher(state, output);

  output.info("HelloDev extension activated");
}

async function deactivate() {
  if (commitWatcher) {
    commitWatcher.close();
    commitWatcher = null;
  }
  if (output) {
    await stopMcpHost(output);
    output.info("HelloDev extension deactivated");
    output.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};
