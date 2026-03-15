# HelloDev PowerShell post-commit hook
$root = git rev-parse --show-toplevel
$helloDevDir = Join-Path $root ".hellodev"
$sessionPath = Join-Path $helloDevDir "session.json"
if (-not (Test-Path $sessionPath)) { exit 0 }

$hash = (git rev-parse HEAD).Trim()
$message = (git log -1 --pretty=%B | Out-String).Trim().Replace("`r", " ").Replace("`n", " ")
$filesChanged = @(git diff-tree --no-commit-id --name-only -r HEAD).Count
$stats = (git diff --shortstat HEAD~1 HEAD | Out-String)
$added = [regex]::Match($stats, "(\d+) insertion").Groups[1].Value
$removed = [regex]::Match($stats, "(\d+) deletion").Groups[1].Value
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
