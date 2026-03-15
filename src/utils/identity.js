"use strict";

const { execFile } = require("child_process");

function runGitConfig(key) {
  return new Promise((resolve) => {
    execFile("git", ["config", "--global", key], { windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve("");
        return;
      }
      resolve((stdout || "").trim());
    });
  });
}

async function getGitIdentity() {
  const [name, email] = await Promise.all([runGitConfig("user.name"), runGitConfig("user.email")]);

  return {
    name,
    email,
    isComplete: Boolean(name && email)
  };
}

module.exports = {
  getGitIdentity
};
