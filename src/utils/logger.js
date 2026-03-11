// ─── HelloDev Logger ─────────────────────────────────────────────────────────────
// Colored, leveled, timestamped logger for smooth dev & debug experience
// Levels: DEBUG < INFO < SUCCESS < WARN < ERROR
// Usage:
//   const log = require('./logger');
//   log.info("Server started");
//   log.success("Task marked done");
//   log.error("Notion API failed", err);
//   log.debug("Payload", { bugId, developer });

const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";

// ANSI color codes
const C = {
  reset:   "\x1b[0m",
  dim:     "\x1b[2m",
  bold:    "\x1b[1m",

  // Text colors
  white:   "\x1b[37m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  magenta: "\x1b[35m",
  blue:    "\x1b[34m",

  // Background
  bgRed:   "\x1b[41m",
};

// Level hierarchy
const LEVELS = { DEBUG: 0, INFO: 1, SUCCESS: 2, WARN: 3, ERROR: 4 };

const ICONS = {
  DEBUG:   "🔍",
  INFO:    "ℹ️ ",
  SUCCESS: "✅",
  WARN:    "⚠️ ",
  ERROR:   "❌",
  NOTION:  "📋",
  GIT:     "📝",
  TIMER:   "⏱️ ",
  SERVER:  "🚀",
  CLI:     "💻",
};

// ─── Format timestamp ─────────────────────────────────────────────────────────
function timestamp() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, "0");
  const mm  = String(now.getMinutes()).padStart(2, "0");
  const ss  = String(now.getSeconds()).padStart(2, "0");
  const ms  = String(now.getMilliseconds()).padStart(3, "0");
  return `${C.dim}[${hh}:${mm}:${ss}.${ms}]${C.reset}`;
}

// ─── Format label ─────────────────────────────────────────────────────────────
function label(level, color) {
  return `${color}${C.bold}${level.padEnd(7)}${C.reset}`;
}

// ─── Format extra data ────────────────────────────────────────────────────────
function formatExtra(extra) {
  if (!extra) return "";
  if (extra instanceof Error) {
    return `\n${C.red}${extra.stack || extra.message}${C.reset}`;
  }
  if (typeof extra === "object") {
    return `\n${C.dim}${JSON.stringify(extra, null, 2)}${C.reset}`;
  }
  return ` ${C.dim}${extra}${C.reset}`;
}

// ─── Core log function ────────────────────────────────────────────────────────
let _relay = null; // optional relay callback

function setRelay(fn) {
  _relay = typeof fn === 'function' ? fn : null;
}

function log(level, color, icon, message, extra) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;

  const time = timestamp();
  const line = `${time} ${icon} ${label(level, color)} ${message}${formatExtra(extra)}`;
  
  if (level === "ERROR") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }

  // forward to relay if configured (strip ANSI codes)
  if (_relay) {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, "");
    try { _relay({ level, timestamp: time, message: stripped, extra }); }
    catch (e) { /* swallow relay errors */ }
  }
}

// ─── Separator ────────────────────────────────────────────────────────────────
function separator(title = "") {
  const line = "─".repeat(50);
  if (title) {
    console.log(`\n${C.dim}${line}${C.reset}`);
    console.log(`${C.cyan}${C.bold}  ${title}${C.reset}`);
    console.log(`${C.dim}${line}${C.reset}\n`);
  } else {
    console.log(`${C.dim}${line}${C.reset}`);
  }
}

// ─── Section helper (alias for separator with title) ──────────────────────────
function section(title) {
  separator(title);
}

// ─── Banner ───────────────────────────────────────────────────────────────────
function banner() {
  // small ASCII banner for HelloDev
  console.log(`
${C.cyan}${C.bold}
 #     #                             ######                
 #     # ###### #      #       ####  #     # ###### #    # 
 #     # #      #      #      #    # #     # #      #    # 
 ####### #####  #      #      #    # #     # #####  #    # 
 #     # #      #      #      #    # #     # #      #    # 
 #     # ###### ###### ######  ####  ######  ######   ##   
                                                           
${C.reset}${C.dim}  HelloDev Tracker — coding time & commits synced to Notion${C.reset}
`);
}

// ─── Request logger middleware (for Express) ──────────────────────────────────
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, body } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status   = res.statusCode;
    const color    = status >= 500 ? C.red : status >= 400 ? C.yellow : C.green;

    log(
      "INFO",
      C.blue,
      ICONS.SERVER,
      `${C.bold}${method}${C.reset} ${url} → ${color}${status}${C.reset} ${C.dim}(${duration}ms)${C.reset}`,
      Object.keys(body || {}).length ? body : null
    );
  });

  next();
}

// ─── Notion-specific logger ───────────────────────────────────────────────────
function notionLogger(msg, extra) {
  log("DEBUG", C.magenta, ICONS.NOTION, msg, extra);
}

// add helper methods on the function
notionLogger.query = (db, filter) => notionLogger(`Query DB: ${db}`, filter);
notionLogger.update = (pageId, msg) => notionLogger(`Update page ${pageId}: ${msg}`);
notionLogger.create = (db, title) => notionLogger(`Create in ${db}: "${title}"`);
notionLogger.success = (msg) => log("SUCCESS", C.green, ICONS.NOTION, msg);
notionLogger.error = (msg, err) => log("ERROR", C.red, ICONS.NOTION, msg, err);

const notion = notionLogger;

// ─── Git-specific logger ──────────────────────────────────────────────────────
const git = {
  commit:  (msg, stats) => log("INFO", C.cyan, ICONS.GIT, `Commit: "${msg}"`, stats),
  hook:    (msg)        => log("DEBUG", C.cyan, ICONS.GIT, msg),
};

// ─── Timer-specific logger ────────────────────────────────────────────────────
const timer = {
  start:   (time)       => log("INFO", C.yellow, ICONS.TIMER, `Session started at ${time}`),
  stop:    (hrs)        => log("INFO", C.yellow, ICONS.TIMER, `Session ended — Active: ${hrs} hrs`),
  idle:    (mins)       => log("DEBUG", C.yellow, ICONS.TIMER, `Idle detected: ${mins} min`),
};

// also provide a generic timer function for legacy callers that simply
// passed a message; this keeps older modules working without modification
function timerFn(msg, extra) {
  log("INFO", C.yellow, ICONS.TIMER, msg, extra);
}
// expose the structured helpers as properties
timerFn.start = timer.start;
timerFn.stop  = timer.stop;
 timerFn.idle = timer.idle;


// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  debug:   (msg, extra) => log("DEBUG",   C.cyan,    ICONS.DEBUG,   msg, extra),
  info:    (msg, extra) => log("INFO",    C.white,   ICONS.INFO,    msg, extra),
  success: (msg, extra) => log("SUCCESS", C.green,   ICONS.SUCCESS, msg, extra),
  warn:    (msg, extra) => log("WARN",    C.yellow,  ICONS.WARN,    msg, extra),
  error:   (msg, extra) => log("ERROR",   C.red,     ICONS.ERROR,   msg, extra),

  // Domain-specific loggers
  notion,
  git,
  // timer exported as a function with helpers attached; legacy code used
  // logger.timer(msg) while newer code can call logger.timer.start/stop/idle
  timer: timerFn,

  // Utilities
  separator,
  section,
  banner,
  requestLogger,

  // relay support
  setRelay,
};