"use strict";

const vscode = require("vscode");

function notImplemented(label) {
  return `HelloDev: ${label} is scaffolded and next in implementation.`;
}

function registerHelloDevCommands(context, _state, output) {
  const commands = [
    ["hellodev.startTask", "Start Task"],
    ["hellodev.completeTask", "Complete Task"],
    ["hellodev.viewStatus", "View Status"],
    ["hellodev.myTasks", "My Tasks"],
    ["hellodev.generateStandup", "Generate Standup"],
    ["hellodev.installGitHook", "Install Git Hook"],
    ["hellodev.openOnboarding", "Open Onboarding"]
  ];

  for (const [commandId, label] of commands) {
    const disposable = vscode.commands.registerCommand(commandId, async () => {
      output.info(`Command invoked: ${commandId}`);
      await vscode.window.showInformationMessage(notImplemented(label));
    });
    context.subscriptions.push(disposable);
  }
}

module.exports = {
  registerHelloDevCommands
};
