"use strict";

function createRuntimeState(context) {
  const keys = {
    role: "hellodev.userRole",
    notionToken: "hellodev.notionToken",
    sprintDbId: "hellodev.sprintDbId",
    logsDbId: "hellodev.logsDbId",
    devsDbId: "hellodev.devsDbId"
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
    },
    async setWorkspaceDatabaseIds(ids) {
      await context.globalState.update(keys.sprintDbId, ids.sprintDbId);
      await context.globalState.update(keys.logsDbId, ids.logsDbId);
      await context.globalState.update(keys.devsDbId, ids.devsDbId);
    },
    getWorkspaceDatabaseIds() {
      return {
        sprintDbId: context.globalState.get(keys.sprintDbId),
        logsDbId: context.globalState.get(keys.logsDbId),
        devsDbId: context.globalState.get(keys.devsDbId)
      };
    }
  };
}

module.exports = {
  createRuntimeState
};
