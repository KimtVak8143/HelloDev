"use strict";

const vscode = require("vscode");
const { OnboardingPanel } = require("../onboarding/OnboardingPanel");
const {
  getMyTasks,
  startTask,
  getStatus,
  completeTask,
  registerDeveloper,
  generateStandup,
  publishStandup
} = require("../runtime/actions");
const { installGitHooks } = require("../trackers/gitHook");
const { StandupPanel } = require("./standupPanel");

async function handleMyTasks(state, output) {
  try {
    const { identity, tasks } = await getMyTasks(state);
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
  try {
    const { identity, tasks } = await getMyTasks(state);
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

    const session = await startTask(state, picked.task);
    await registerDeveloper(state, "developer");
    output.info(`Session started for ${session.taskId} by ${session.developerName}`);

    await vscode.window.showInformationMessage(
      `Started ${session.taskId}: ${session.taskName}`
    );
  } catch (error) {
    output.error(`startTask failed: ${error.message}`);
    await vscode.window.showErrorMessage(`HelloDev Start Task failed: ${error.message}`);
  }
}

async function handleViewStatus(state) {
  const status = getStatus(state);
  if (!status.active) {
    await vscode.window.showInformationMessage("No active session running.");
    return;
  }

  await vscode.window.showInformationMessage(
    `Active: ${status.taskId} (${status.taskName}) | ${status.elapsed} | ${status.commits} commits`
  );
}

async function handleCompleteTask(state, output) {
  try {
    const { active, result } = await completeTask(state);
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

async function handleGenerateStandup(state, output) {
  try {
    const report = await generateStandup(state);
    StandupPanel.open(report);

    const publishChoice = await vscode.window.showInformationMessage(
      "Standup generated. Publish to Notion now?",
      "Publish",
      "Skip"
    );

    if (publishChoice === "Publish") {
      let parentPageId = await state.getStandupPageId();
      if (!parentPageId) {
        const input = await vscode.window.showInputBox({
          title: "Standup Parent Page ID",
          prompt: "Paste Notion parent page ID where standup pages should be created",
          ignoreFocusOut: true
        });
        if (input && input.trim()) {
          parentPageId = input.trim().replace(/-/g, "");
          await state.setStandupPageId(parentPageId);
        }
      }

      const publish = await publishStandup(state, report);
      if (publish.published) {
        await vscode.window.showInformationMessage("Standup published to Notion.");
      } else {
        await vscode.window.showWarningMessage(
          "Standup not published. Set standup parent page ID and retry."
        );
      }
    }

    output.info("Standup generated");
    output.show(true);
    output.info(report);
  } catch (error) {
    output.error(`generateStandup failed: ${error.message}`);
    await vscode.window.showErrorMessage(`HelloDev Generate Standup failed: ${error.message}`);
  }
}

function registerHelloDevCommands(context, _state, output) {
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

  const generateStandupCommand = vscode.commands.registerCommand(
    "hellodev.generateStandup",
    async () => {
      output.info("Command invoked: hellodev.generateStandup");
      await handleGenerateStandup(_state, output);
    }
  );
  context.subscriptions.push(generateStandupCommand);

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
