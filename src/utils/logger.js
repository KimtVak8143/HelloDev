// ─── HelloDev Logger ─────────────────────────────────────────────────────────────
// Simple Node.js logging via pino
// Usage:
//   const log = require('./logger');
//   log.info("Server started");
//   log.debug("Debug info", { key: "value" });
//   log.error("Error occurred", err);

const pino = require("pino");

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

// Create pino logger instance
const baseLogger = pino({ level: LOG_LEVEL.toLowerCase() });

// Pino HTTP middleware for Express 
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url } = req;
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    baseLogger.info({ method, url, status: res.statusCode, duration, module: "http" }, `${method} ${url}`);
  });
  
  next();
}

// ─── Separator ────────────────────────────────────────────────────────────
function separator(title = "") {
  const line = "─".repeat(50);
  if (title) {
    baseLogger.info(`\n${line}`);
    baseLogger.info(`  ${title}`);
    baseLogger.info(`${line}\n`);
  } else {
    baseLogger.info(line);
  }
}

// ─── Section helper (alias for separator with title) ──────────────────────
function section(title) {
  separator(title);
}

// ─── Banner ───────────────────────────────────────────────────────────────
function banner() {
  const bannerText = `
 #     #                             ######                
 #     # ###### #      #       ####  #     # ###### #    # 
 #     # #      #      #      #    # #     # #      #    # 
 ####### #####  #      #      #    # #     # #####  #    # 
 #     # #      #      #      #    # #     # #      #    # 
 #     # ###### ###### ######  ####  ######  ######   ##   
                                                           
  HelloDev Tracker — coding time & commits synced to Notion
`;
  baseLogger.info(bannerText);
}

// ─── Notion-specific logger ───────────────────────────────────────────────
function notionLogger(msg, extra) {
  baseLogger.debug({ module: "notion", ...extra }, msg);
}

notionLogger.query = (db, filter) => notionLogger(`Query DB: ${db}`, { filter });
notionLogger.update = (pageId, msg) => notionLogger(`Update page ${pageId}: ${msg}`);
notionLogger.create = (db, title) => notionLogger(`Create in ${db}: "${title}"`);
notionLogger.success = (msg, extra) => baseLogger.info({ module: "notion", ...extra }, msg);
notionLogger.error = (msg, err) => baseLogger.error({ module: "notion", error: err }, msg);

const notion = notionLogger;

// ─── Git-specific logger ──────────────────────────────────────────────────
const git = {
  commit: (msg, stats) => baseLogger.info({ module: "git", ...stats }, `Commit: "${msg}"`),
  hook: (msg) => baseLogger.debug({ module: "git" }, msg)
};

// ─── Timer-specific logger ────────────────────────────────────────────────
const timer = {
  start: (time) => baseLogger.info({ module: "timer" }, `Session started at ${time}`),
  stop: (hrs) => baseLogger.info({ module: "timer" }, `Session ended — Active: ${hrs} hrs`),
  idle: (mins) => baseLogger.debug({ module: "timer" }, `Idle detected: ${mins} min`)
};

// Also provide a generic timer function for legacy callers
function timerFn(msg, extra) {
  baseLogger.info({ module: "timer", ...extra }, msg);
}

timerFn.start = timer.start;
timerFn.stop = timer.stop;
timerFn.idle = timer.idle;

// ─── Exports ──────────────────────────────────────────────────────────────
module.exports = {
  debug: (msg, extra) => baseLogger.debug(extra || {}, msg),
  info: (msg, extra) => baseLogger.info(extra || {}, msg),
  success: (msg, extra) => baseLogger.info(extra || {}, `✅ ${msg}`),
  warn: (msg, extra) => baseLogger.warn(extra || {}, msg),
  error: (msg, extra) => baseLogger.error(extra || {}, msg),

  // Domain-specific loggers
  notion,
  git,
  timer: timerFn,

  // Utilities
  separator,
  section,
  banner,
  requestLogger,

  // Base logger for advanced usage
  logger: baseLogger
};
