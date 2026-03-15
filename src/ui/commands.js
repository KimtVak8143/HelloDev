"use strict";

const vscode = require("vscode");
const { OnboardingPanel } = require("../onboarding/OnboardingPanel");
const { getGitIdentity } = require("../utils/identity");
const {
  listTasksForDeveloper,
  startTaskForDeveloper,
  completeTaskForDeveloper
} = require("../notion/runtimeTasks");
const { installGitHooks } = require("../trackers/gitHook");
const { clearSession, saveSession } = require("../runtime/sessionStore");

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

async function handleStartTask(state, output) {
  const current = state.getActiveSession();
  if (current) {
    await vscode.window.showWarningMessage(
      `Active task already running: ${current.taskId} (${current.taskName}).`
    );
    return;
  }

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
        detail: `Assigned to: ${identity.name}`,
        task
      })),
      {
        title: "HelloDev: Start Task",
        placeHolder: "Select a task to start"
      }
    );

    if (!picked) {
      return;
    }

    const session = await startTaskForDeveloper(state, picked.task, identity.name);
    state.setActiveSession({
      ...session,
      commits: [],
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0
    });
    saveSession(state.getActiveSession());
    output.info(`Session started for ${session.taskId} by ${session.developerName}`);

    await vscode.window.showInformationMessage(
      `Started ${session.taskId}: ${session.taskName}`
    );
  } catch (error) {
    output.error(`startTask failed: ${error.message}`);
    await vscode.window.showErrorMessage(`HelloDev Start Task failed: ${error.message}`);
  }
}

function formatElapsed(startedAt) {
  const ms = Math.max(Date.now() - new Date(startedAt).getTime(), 0);
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

async function handleViewStatus(state) {
  const active = state.getActiveSession();
  if (!active) {
    await vscode.window.showInformationMessage("No active session running.");
    return;
  }

  await vscode.window.showInformationMessage(
    `Active: ${active.taskId} (${active.taskName}) | ${formatElapsed(active.startedAt)} | ${active.commits.length} commits`
  );
}

async function handleCompleteTask(state, output) {
  const active = state.getActiveSession();
  if (!active) {
    await vscode.window.showInformationMessage("No active session to complete.");
    return;
  }

  try {
    const result = await completeTaskForDeveloper(state, active);
    state.clearActiveSession();
    clearSession();
    output.info(`Session completed for ${active.taskId}`);
    await vscode.window.showInformationMessage(
      `Completed ${active.taskId}: ${active.taskName} (${result.hours} hrs)`
    );
  } catch (error) {
    output.error(`completeTask failed: ${error.message}`);
    await vscode.window.showErrorMessage(`HelloDev Complete Task failed: ${error.message}`);
  }
}

async function handleInstallGitHook(output) {
  try {
    installGitHooks(output);
    await vscode.window.showInformationMessage("HelloDev git hook installed.");
  } catch (error) {
    output.error(`installGitHook failed: ${error.message}`);
    await vscode.window.showErrorMessage(`HelloDev Install Git Hook failed: ${error.message}`);
  }
}

function registerHelloDevCommands(context, _state, output) {
  const scaffoldCommands = [
    ["hellodev.generateStandup", "Generate Standup"]
  ];

  for (const [commandId, label] of scaffoldCommands) {
    const disposable = vscode.commands.registerCommand(commandId, async () => {
      output.info(`Command invoked: ${commandId}`);
      await vscode.window.showInformationMessage(notImplemented(label));
    });
    context.subscriptions.push(disposable);
  }

  const startTaskCommand = vscode.commands.registerCommand("hellodev.startTask", async () => {
    output.info("Command invoked: hellodev.startTask");
    await handleStartTask(_state, output);
  });
  context.subscriptions.push(startTaskCommand);

  const myTasksCommand = vscode.commands.registerCommand("hellodev.myTasks", async () => {
    output.info("Command invoked: hellodev.myTasks");
    await handleMyTasks(_state, output);
  });
  context.subscriptions.push(myTasksCommand);

  const viewStatusCommand = vscode.commands.registerCommand("hellodev.viewStatus", async () => {
    output.info("Command invoked: hellodev.viewStatus");
    await handleViewStatus(_state);
  });
  context.subscriptions.push(viewStatusCommand);

  const completeTaskCommand = vscode.commands.registerCommand("hellodev.completeTask", async () => {
    output.info("Command invoked: hellodev.completeTask");
    await handleCompleteTask(_state, output);
  });
  context.subscriptions.push(completeTaskCommand);

  const installGitHookCommand = vscode.commands.registerCommand(
    "hellodev.installGitHook",
    async () => {
      output.info("Command invoked: hellodev.installGitHook");
      await handleInstallGitHook(output);
    }
  );
  context.subscriptions.push(installGitHookCommand);

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
