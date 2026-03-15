"use strict";

const vscode = require("vscode");
const { captureNotionToken } = require("./notionAuth");
const { setupMaintainerWorkspace } = require("./setupMaintainer");

class OnboardingPanel {
  static currentPanel = undefined;

  static open(context, state, output) {
    if (OnboardingPanel.currentPanel) {
      OnboardingPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return OnboardingPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "hellodevOnboarding",
      "HelloDev Onboarding",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    OnboardingPanel.currentPanel = new OnboardingPanel(panel, context, state, output);
    return OnboardingPanel.currentPanel;
  }

  constructor(panel, context, state, output) {
    this.panel = panel;
    this.context = context;
    this.state = state;
    this.output = output;

    this.panel.webview.html = this.getHtml();
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      context.subscriptions
    );
    this.panel.onDidDispose(() => {
      OnboardingPanel.currentPanel = undefined;
    }, null, context.subscriptions);
  }

  async handleMessage(message) {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "selectRole") {
      const role = message.role === "maintainer" ? "maintainer" : "developer";
      await this.state.setRole(role);
      this.output.info(`Onboarding role selected: ${role}`);
      const tokenResult = await captureNotionToken(this.state, this.output);
      if (tokenResult.saved) {
        if (role === "maintainer") {
          try {
            const setup = await setupMaintainerWorkspace(this.state, this.output);
            if (setup.created) {
              await vscode.window.showInformationMessage(
                "HelloDev onboarding complete for maintainer. Databases created."
              );
            } else {
              await vscode.window.showInformationMessage(
                "HelloDev onboarding complete for maintainer. Existing databases reused."
              );
            }
          } catch (error) {
            this.output.error(`Maintainer setup failed: ${error.message}`);
            await vscode.window.showErrorMessage(
              `HelloDev maintainer setup failed: ${error.message}`
            );
          }
        } else {
          await vscode.window.showInformationMessage(
            `HelloDev onboarding complete for ${role}.`
          );
        }
      }
      return;
    }

    if (message.type === "close") {
      this.panel.dispose();
    }
  }

  getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HelloDev Onboarding</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      font-family: var(--vscode-font-family);
      margin: 24px;
    }
    h1 {
      margin: 0 0 8px;
    }
    p {
      margin: 0 0 18px;
      opacity: 0.85;
    }
    .row {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }
    button {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 10px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    button.secondary {
      background: transparent;
      color: var(--vscode-foreground);
    }
  </style>
</head>
<body>
  <h1>Welcome to HelloDev</h1>
  <p>Choose your role to continue onboarding.</p>
  <div class="row">
    <button id="maintainer">Maintainer</button>
    <button id="developer">Developer</button>
    <button id="close" class="secondary">Close</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById("maintainer").addEventListener("click", () => {
      vscode.postMessage({ type: "selectRole", role: "maintainer" });
    });
    document.getElementById("developer").addEventListener("click", () => {
      vscode.postMessage({ type: "selectRole", role: "developer" });
    });
    document.getElementById("close").addEventListener("click", () => {
      vscode.postMessage({ type: "close" });
    });
  </script>
</body>
</html>`;
  }
}

module.exports = {
  OnboardingPanel
};
