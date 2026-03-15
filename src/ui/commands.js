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

  const onboardingCommand = vscode.commands.registerCommand(
    "hellodev.openOnboarding",
    async () => {
      output.info("Command invoked: hellodev.openOnboarding");
      OnboardingPanel.open(context, _state, output);
    }
  );
  context.subscriptions.push(onboardingCommand);
}

module.exports = {
  registerHelloDevCommands
};
