"use strict";

const vscode = require("vscode");
const { OnboardingPanel } = require("../onboarding/OnboardingPanel");
const { getGitIdentity } = require("../utils/identity");
const { listTasksForDeveloper } = require("../notion/runtimeTasks");

function notImplemented(label) {
  return `HelloDev: ${label} is scaffolded and next in implementation.`;
}

async function handleMyTasks(state, output) {
  const identity = await getGitIdentity();
  if (!identity.name) {
    await vscode.window.showErrorMessage(
      "Git user.name is missing. Set it with: git config --global user.name \"Your Name\""
    );
    return;
  }

  try {
    const tasks = await listTasksForDeveloper(state, identity.name);
    if (tasks.length === 0) {
      await vscode.window.showInformationMessage(
        `No pending tasks for ${identity.name}.`
      );
      return;
    }

    const picked = await vscode.window.showQuickPick(
      tasks.map((task) => ({
        label: `${task.id} - ${task.name}`,
        description: `${task.status} | ${task.priority} | ${task.points} pts`,
        detail: `Assigned to: ${identity.name}`
      })),
      {
        title: "HelloDev: My Tasks",
        placeHolder: "Tasks assigned to your git identity"
      }
    );

    if (picked) {
      output.info(`Task viewed: ${picked.label}`);
    }
  } catch (error) {
    output.error(`myTasks failed: ${error.message}`);
    await vscode.window.showErrorMessage(`HelloDev My Tasks failed: ${error.message}`);
  }
}

function registerHelloDevCommands(context, _state, output) {
  const scaffoldCommands = [
    ["hellodev.startTask", "Start Task"],
    ["hellodev.completeTask", "Complete Task"],
    ["hellodev.viewStatus", "View Status"],
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

  const myTasksCommand = vscode.commands.registerCommand("hellodev.myTasks", async () => {
    output.info("Command invoked: hellodev.myTasks");
    await handleMyTasks(_state, output);
  });
  context.subscriptions.push(myTasksCommand);

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
