"use strict";

const vscode = require("vscode");

function createOutput() {
  const channel = vscode.window.createOutputChannel("HelloDev");

  return {
    info(message) {
      channel.appendLine(`[INFO] ${message}`);
    },
    warn(message) {
      channel.appendLine(`[WARN] ${message}`);
    },
    error(message) {
      channel.appendLine(`[ERROR] ${message}`);
    },
    show(preserveFocus) {
      channel.show(Boolean(preserveFocus));
    },
    dispose() {
      channel.dispose();
    }
  };
}

module.exports = {
  createOutput
};
