"use strict";

const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

function getWorkspaceRoot() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("Open a workspace folder to use HelloDev session tracking.");
  }
  return folder.uri.fsPath;
}

function getHelloDevDir() {
  return path.join(getWorkspaceRoot(), ".hellodev");
}

function getSessionFilePath() {
  return path.join(getHelloDevDir(), "session.json");
}

function getPendingCommitPath() {
  return path.join(getHelloDevDir(), "pending-commit.json");
}

function ensureHelloDevDir() {
  fs.mkdirSync(getHelloDevDir(), { recursive: true });
}

function saveSession(session) {
  ensureHelloDevDir();
  fs.writeFileSync(getSessionFilePath(), JSON.stringify(session, null, 2), "utf8");
}

function loadSession() {
  const sessionPath = getSessionFilePath();
  if (!fs.existsSync(sessionPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(sessionPath, "utf8"));
}

function clearSession() {
  const sessionPath = getSessionFilePath();
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

module.exports = {
  getWorkspaceRoot,
  getHelloDevDir,
  getSessionFilePath,
  getPendingCommitPath,
  ensureHelloDevDir,
  saveSession,
  loadSession,
  clearSession
};
