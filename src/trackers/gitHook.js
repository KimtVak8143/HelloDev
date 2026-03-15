"use strict";

const fs = require("fs");
const path = require("path");
const { ensureHelloDevDir, getWorkspaceRoot } = require("../runtime/sessionStore");

function shellHookContent() {
  return `#!/bin/sh
HELLODEV_DIR="$(git rev-parse --show-toplevel)/.hellodev"
[ ! -f "$HELLODEV_DIR/session.json" ] && exit 0

HASH=$(git rev-parse HEAD)
MESSAGE=$(git log -1 --pretty=%B | tr -d '\\r' | tr '\\n' ' ')
FILES=$(git diff-tree --no-commit-id --name-only -r HEAD | wc -l | tr -d ' ')
STATS=$(git diff --shortstat HEAD~1 HEAD)
ADDED=$(echo "$STATS" | grep -o '[0-9]* insertion' | grep -o '[0-9]*')
REMOVED=$(echo "$STATS" | grep -o '[0-9]* deletion' | grep -o '[0-9]*')

cat > "$HELLODEV_DIR/pending-commit.json" << EOF
{
  "hash": "$HASH",
  "message": "$MESSAGE",
  "filesChanged": \${FILES:-0},
  "linesAdded": \${ADDED:-0},
  "linesRemoved": \${REMOVED:-0},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
`;
}

function powershellHookContent() {
  return `# HelloDev PowerShell post-commit hook
$root = git rev-parse --show-toplevel
$helloDevDir = Join-Path $root ".hellodev"
$sessionPath = Join-Path $helloDevDir "session.json"
if (-not (Test-Path $sessionPath)) { exit 0 }

$hash = (git rev-parse HEAD).Trim()
$message = (git log -1 --pretty=%B | Out-String).Trim().Replace("\`r", " ").Replace("\`n", " ")
$filesChanged = @(git diff-tree --no-commit-id --name-only -r HEAD).Count
$stats = (git diff --shortstat HEAD~1 HEAD | Out-String)
$added = [regex]::Match($stats, "(\\d+) insertion").Groups[1].Value
$removed = [regex]::Match($stats, "(\\d+) deletion").Groups[1].Value
if (-not $added) { $added = "0" }
if (-not $removed) { $removed = "0" }

$payload = @{
  hash = $hash
  message = $message
  filesChanged = [int]$filesChanged
  linesAdded = [int]$added
  linesRemoved = [int]$removed
  timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json -Depth 3

$pendingPath = Join-Path $helloDevDir "pending-commit.json"
Set-Content -Path $pendingPath -Value $payload -Encoding UTF8
`;
}

function installGitHooks(output) {
  const root = getWorkspaceRoot();
  const hooksDir = path.join(root, ".git", "hooks");
  if (!fs.existsSync(hooksDir)) {
    throw new Error("No .git/hooks found. Open a git repository workspace.");
  }

  ensureHelloDevDir();

  const shellPath = path.join(hooksDir, "post-commit");
  fs.writeFileSync(shellPath, shellHookContent(), "utf8");
  fs.chmodSync(shellPath, 0o755);

  const psPath = path.join(hooksDir, "post-commit.ps1");
  fs.writeFileSync(psPath, powershellHookContent(), "utf8");

  output.info("Git hook installed: .git/hooks/post-commit");
}

module.exports = {
  installGitHooks
};
