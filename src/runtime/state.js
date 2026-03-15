"use strict";

function createRuntimeState(context) {
  return {
    context,
    activeSession: null
  };
}

module.exports = {
  createRuntimeState
};
