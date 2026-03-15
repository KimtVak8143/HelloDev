"use strict";

let started = false;

async function startMcpHost(output) {
  if (started) {
    return;
  }
  started = true;
  output.info("MCP host bootstrap ready (tool wiring migration pending)");
}

async function stopMcpHost(output) {
  if (!started) {
    return;
  }
  started = false;
  output.info("MCP host stopped");
}

module.exports = {
  startMcpHost,
  stopMcpHost
};
