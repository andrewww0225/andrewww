# Push this repo to GitHub, then confirm the remote HEAD equals the local HEAD. Prints one result line.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File tools\push.ps1
Set-Location (Split-Path $PSScriptRoot)
$log = git push 2>&1 | Out-String
$local = (git rev-parse HEAD).Trim()
$remote = ((git ls-remote origin HEAD) -split '\s+')[0]
if ($remote -eq $local) {
  "PUSH OK  remote = local = $($local.Substring(0, 7))  ($((git log -1 --format=%s).Trim()))"
} else {
  "PUSH FAILED  local=$($local.Substring(0, 7)) remote=$remote"
  $log
}
