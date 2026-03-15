"use strict";

const { startStdioMcpServer } = require("./index");

let started = false;
let connection = null;

async function startMcpHost(state, output) {
  if (started) {
    return;
  }
  if (process.env.HELLODEV_ENABLE_MCP_STDIO !== "1") {
    output.info("MCP stdio host is disabled (set HELLODEV_ENABLE_MCP_STDIO=1 to enable)");
    return;
  }

  connection = await startStdioMcpServer(state, output);
  started = true;
  output.info("MCP stdio host started");
}

async function stopMcpHost(output) {
  if (!started) {
    return;
  }
  if (connection?.transport?.close) {
    await connection.transport.close();
  }
  connection = null;
  started = false;
  output.info("MCP host stopped");
}

module.exports = {
  startMcpHost,
  stopMcpHost
};
