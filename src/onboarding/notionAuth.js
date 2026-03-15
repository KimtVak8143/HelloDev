"use strict";

const vscode = require("vscode");

function isLikelyIntegrationToken(value) {
  return typeof value === "string" && value.trim().startsWith("ntn_");
}

async function captureNotionToken(state, output) {
  const token = await vscode.window.showInputBox({
    title: "HelloDev Notion Integration Token",
    prompt: "Paste your Notion integration token (starts with ntn_)",
    password: true,
    ignoreFocusOut: true,
    validateInput(input) {
      if (!input || !input.trim()) {
        return "Token is required.";
      }
      if (!isLikelyIntegrationToken(input.trim())) {
        return "Token should start with ntn_.";
      }
      return null;
    }
  });

  if (!token) {
    return { saved: false };
  }

  await state.setNotionToken(token.trim());
  output.info("Notion token saved to VSCode secret storage");
  return { saved: true };
}

module.exports = {
  captureNotionToken
};
