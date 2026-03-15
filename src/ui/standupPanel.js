"use strict";

const vscode = require("vscode");

class StandupPanel {
  static currentPanel = undefined;

  static open(report) {
    if (StandupPanel.currentPanel) {
      StandupPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      StandupPanel.currentPanel.update(report);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "hellodevStandup",
      "HelloDev Standup",
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    StandupPanel.currentPanel = new StandupPanel(panel, report);
  }

  constructor(panel, report) {
    this.panel = panel;
    this.update(report);
    this.panel.onDidDispose(() => {
      StandupPanel.currentPanel = undefined;
    });
  }

  update(report) {
    this.panel.webview.html = this.getHtml(report);
  }

  getHtml(report) {
    const escaped = report
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HelloDev Standup</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      margin: 20px;
      line-height: 1.5;
    }
    h1 {
      margin-top: 0;
    }
    pre {
      white-space: pre-wrap;
      padding: 12px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--vscode-editor-background) 80%, black 20%);
      border: 1px solid var(--vscode-panel-border);
    }
  </style>
</head>
<body>
  <h1>HelloDev Standup</h1>
  <pre>${escaped}</pre>
</body>
</html>`;
  }
}

module.exports = {
  StandupPanel
};
