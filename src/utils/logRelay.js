// ─── Log Relay via Server-Sent Events ────────────────────────────────────────
// Keeps a list of SSE clients and broadcasts every log entry to them.
// Usage: import { addLogEntry, sseHandler } from './logRelay'

const LOG_BUFFER_SIZE = 200; // keep last 200 logs in memory

const clients    = new Set();  // active SSE connections
const logBuffer  = [];         // in-memory ring buffer

// ─── Add a log entry (called by logger) ──────────────────────────────────────
function addLogEntry(entry) {
  // entry shape: { level, message, timestamp, extra }
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();

  // Broadcast to all connected SSE clients
  const data = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch (_) { clients.delete(res); }
  }
}

// ─── SSE endpoint handler ─────────────────────────────────────────────────────
function sseHandler(req, res) {
  // SSE headers
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Send all buffered logs immediately on connect
  for (const entry of logBuffer) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  // Register this client
  clients.add(res);

  // Send a ping every 15s to keep connection alive
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch (_) { clearInterval(ping); }
  }, 15000);

  // Cleanup on disconnect
  req.on("close", () => {
    clients.delete(res);
    clearInterval(ping);
  });
}

// ─── Serve the log viewer HTML page ──────────────────────────────────────────
function logViewerPage(req, res) {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>HelloDev Live Logs</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .logo {
      font-size: 16px;
      font-weight: bold;
      color: #58a6ff;
      letter-spacing: 2px;
    }

    .logo span { color: #3fb950; }

    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #3fb950;
      box-shadow: 0 0 6px #3fb950;
      animation: pulse 2s infinite;
    }

    .status-dot.disconnected { background: #f85149; box-shadow: 0 0 6px #f85149; animation: none; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    .status-text { color: #8b949e; font-size: 12px; }

    button {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: background 0.15s;
    }
    button:hover { background: #30363d; }

    /* ── Filter bar ── */
    .filters {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 8px 20px;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }

    .filter-label { color: #8b949e; font-size: 11px; margin-right: 4px; }

    .filter-btn {
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      border: 1px solid transparent;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .filter-btn.active { border-color: currentColor; }
    .filter-btn[data-level="ALL"]     { color: #c9d1d9; background: #21262d; }
    .filter-btn[data-level="DEBUG"]   { color: #79c0ff; background: #0d2136; }
    .filter-btn[data-level="INFO"]    { color: #c9d1d9; background: #1c2128; }
    .filter-btn[data-level="SUCCESS"] { color: #3fb950; background: #0d2118; }
    .filter-btn[data-level="WARN"]    { color: #d29922; background: #231c0d; }
    .filter-btn[data-level="ERROR"]   { color: #f85149; background: #2d1012; }

    .search-input {
      margin-left: auto;
      background: #0d1117;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-family: inherit;
      width: 200px;
    }
    .search-input:focus { outline: none; border-color: #58a6ff; }

    /* ── Log area ── */
    #logs {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    .log-entry {
      display: flex;
      gap: 12px;
      padding: 4px 20px;
      border-left: 3px solid transparent;
      transition: background 0.1s;
      line-height: 1.6;
    }
    .log-entry:hover { background: #161b22; }

    .log-entry.hidden { display: none; }

    .log-entry[data-level="DEBUG"]   { border-color: #1f6feb; }
    .log-entry[data-level="INFO"]    { border-color: #30363d; }
    .log-entry[data-level="SUCCESS"] { border-color: #238636; }
    .log-entry[data-level="WARN"]    { border-color: #9e6a03; }
    .log-entry[data-level="ERROR"]   { border-color: #da3633; background: #1a0a0a; }

    .ts    { color: #484f58; white-space: nowrap; flex-shrink: 0; }
    .icon  { flex-shrink: 0; width: 20px; text-align: center; }

    .lvl   { font-weight: bold; flex-shrink: 0; width: 60px; font-size: 11px; }
    .lvl[data-level="DEBUG"]   { color: #79c0ff; }
    .lvl[data-level="INFO"]    { color: #8b949e; }
    .lvl[data-level="SUCCESS"] { color: #3fb950; }
    .lvl[data-level="WARN"]    { color: #d29922; }
    .lvl[data-level="ERROR"]   { color: #f85149; }

    .msg   { color: #c9d1d9; flex: 1; word-break: break-all; }
    .extra {
      color: #484f58;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      display: block;
      margin-top: 2px;
    }

    /* ── Footer ── */
    footer {
      background: #161b22;
      border-top: 1px solid #30363d;
      padding: 6px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      font-size: 11px;
      color: #484f58;
    }

    #count { color: #8b949e; }

    /* ── Scrollbar ── */
    #logs::-webkit-scrollbar { width: 6px; }
    #logs::-webkit-scrollbar-track { background: #0d1117; }
    #logs::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  </style>
</head>
<body>

<header>
  <div class="logo">HelloDev <span>▸</span> LIVE LOGS</div>
  <div class="controls">
    <div class="status-dot" id="dot"></div>
    <span class="status-text" id="statusText">Connecting...</span>
    <button onclick="clearLogs()">Clear</button>
    <button onclick="toggleScroll()" id="scrollBtn">⏸ Pause scroll</button>
  </div>
</header>

<div class="filters">
  <span class="filter-label">LEVEL</span>
  <button class="filter-btn active" data-level="ALL"     onclick="setFilter('ALL')">All</button>
  <button class="filter-btn"        data-level="DEBUG"   onclick="setFilter('DEBUG')">Debug</button>
  <button class="filter-btn"        data-level="INFO"    onclick="setFilter('INFO')">Info</button>
  <button class="filter-btn"        data-level="SUCCESS" onclick="setFilter('SUCCESS')">Success</button>
  <button class="filter-btn"        data-level="WARN"    onclick="setFilter('WARN')">Warn</button>
  <button class="filter-btn"        data-level="ERROR"   onclick="setFilter('ERROR')">Error</button>
  <input class="search-input" id="search" placeholder="🔍 Search logs..." oninput="applySearch()" />
</div>

<div id="logs"></div>

<footer>
  <span id="count">0 entries</span>
  <span>HelloDev Tracker — Notion MCP</span>
</footer>

<script>
  let activeFilter  = 'ALL';
  let autoScroll    = true;
  let totalCount    = 0;

  const logsEl      = document.getElementById('logs');
  const dot         = document.getElementById('dot');
  const statusText  = document.getElementById('statusText');
  const scrollBtn   = document.getElementById('scrollBtn');
  const countEl     = document.getElementById('count');

  const ICONS = {
    DEBUG: '🔍', INFO: 'ℹ️', SUCCESS: '✅', WARN: '⚠️', ERROR: '❌'
  };

  // ── Connect SSE ────────────────────────────────────────────────────────────
  function connect() {
    const es = new EventSource('/logs/stream');

    es.onopen = () => {
      dot.classList.remove('disconnected');
      statusText.textContent = 'Connected';
    };

    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        appendLog(entry);
      } catch (_) {}
    };

    es.onerror = () => {
      dot.classList.add('disconnected');
      statusText.textContent = 'Reconnecting...';
      es.close();
      setTimeout(connect, 3000);
    };
  }

  // ── Render a log entry ────────────────────────────────────────────────────
  function appendLog(entry) {
    totalCount++;
    countEl.textContent = totalCount + ' entries';

    const div = document.createElement('div');
    div.className = 'log-entry';
    div.dataset.level   = entry.level;
    div.dataset.message = (entry.message || '').toLowerCase();

    const searchVal = document.getElementById('search').value.toLowerCase();
    const hidden =
      (activeFilter !== 'ALL' && entry.level !== activeFilter) ||
      (searchVal && !div.dataset.message.includes(searchVal));
    if (hidden) div.classList.add('hidden');

    const extra = entry.extra
      ? \`<span class="extra">\${
          typeof entry.extra === 'object'
            ? JSON.stringify(entry.extra, null, 2)
            : entry.extra
        }</span>\`
      : '';

    div.innerHTML = \`
      <span class="ts">\${entry.timestamp}</span>
      <span class="icon">\${ICONS[entry.level] || '▸'}</span>
      <span class="lvl" data-level="\${entry.level}">\${entry.level}</span>
      <span class="msg">\${entry.message}\${extra}</span>
    \`;

    logsEl.appendChild(div);
    if (autoScroll) logsEl.scrollTop = logsEl.scrollHeight;
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  function setFilter(level) {
    activeFilter = level;
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.level === level);
    });
    applyFilters();
  }

  function applySearch() { applyFilters(); }

  function applyFilters() {
    const searchVal = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('.log-entry').forEach(el => {
      const levelMatch   = activeFilter === 'ALL' || el.dataset.level === activeFilter;
      const searchMatch  = !searchVal || el.dataset.message.includes(searchVal);
      el.classList.toggle('hidden', !(levelMatch && searchMatch));
    });
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  function clearLogs() {
    logsEl.innerHTML = '';
    totalCount = 0;
    countEl.textContent = '0 entries';
  }

  function toggleScroll() {
    autoScroll = !autoScroll;
    scrollBtn.textContent = autoScroll ? '⏸ Pause scroll' : '▶ Resume scroll';
  }

  connect();
</script>
</body>
</html>`);
}

module.exports = { addLogEntry, sseHandler, logViewerPage };