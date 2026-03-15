"use strict";

const vscode = require("vscode");
const { createRuntimeState } = require("./runtime/state");
const { startMcpHost, stopMcpHost } = require("./mcp/host");
const { createOutput } = require("./utils/output");
const { registerHelloDevCommands } = require("./ui/commands");

let output;

async function activate(context) {
  output = createOutput();
  output.info("Activating HelloDev extension runtime");

  const state = createRuntimeState(context);
  registerHelloDevCommands(context, state, output);
  await startMcpHost(output);

  output.info("HelloDev extension activated");
}

async function deactivate() {
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
