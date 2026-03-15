"use strict";

const vscode = require("vscode");
const { OnboardingPanel } = require("../onboarding/OnboardingPanel");

function notImplemented(label) {
  return `HelloDev: ${label} is scaffolded and next in implementation.`;
}

function registerHelloDevCommands(context, _state, output) {
  const scaffoldCommands = [
    ["hellodev.startTask", "Start Task"],
    ["hellodev.completeTask", "Complete Task"],
    ["hellodev.viewStatus", "View Status"],
    ["hellodev.myTasks", "My Tasks"],
    ["hellodev.generateStandup", "Generate Standup"],
    ["hellodev.installGitHook", "Install Git Hook"]
  ];

  for (const [commandId, label] of scaffoldCommands) {
    const disposable = vscode.commands.registerCommand(commandId, async () => {
      output.info(`Command invoked: ${commandId}`);
      await vscode.window.showInformationMessage(notImplemented(label));
    });
    context.subscriptions.push(disposable);
  }

  const openOnboarding = async (commandId) => {
    output.info(`Command invoked: ${commandId}`);
    OnboardingPanel.open(context, _state, output);
  };

  const onboardingCommands = [
    "hellodev.openOnboarding",
    "hellodev.openonboarding"
  ];
  for (const commandId of onboardingCommands) {
    const disposable = vscode.commands.registerCommand(commandId, async () => {
      await openOnboarding(commandId);
    });
    context.subscriptions.push(disposable);
  }
}

module.exports = {
  registerHelloDevCommands
};
