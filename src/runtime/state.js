"use strict";

function createRuntimeState(context) {
  const keys = {
    role: "hellodev.userRole",
    notionToken: "hellodev.notionToken"
  };

  return {
    context,
    keys,
    activeSession: null,
    async setRole(role) {
      await context.globalState.update(keys.role, role);
    },
    getRole() {
      return context.globalState.get(keys.role);
    },
    async setNotionToken(token) {
      await context.secrets.store(keys.notionToken, token);
    },
    async getNotionToken() {
      return context.secrets.get(keys.notionToken);
    }
  };
}

module.exports = {
  createRuntimeState
};
