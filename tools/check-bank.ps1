# Check all quiz question banks without opening a browser window.
# Loads tools\check.html (which runs the site's own app.js) in headless Edge and prints its report.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File tools\check-bank.ps1
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { 'Edge not found'; exit 1 }
$page = 'file:///' + ((Join-Path $PSScriptRoot 'check.html') -replace '\\', '/')
$tmp = Join-Path $env:TEMP ('quiz-check-' + [guid]::NewGuid())
$dom = & $edge --headless --disable-gpu --allow-file-access-from-files --virtual-time-budget=10000 "--user-data-dir=$tmp" --dump-dom $page 2>$null | Out-String
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
$m = [regex]::Match($dom, '<pre id="out">([\s\S]*?)</pre>')
if (-not $m.Success) { 'Could not read report from check.html'; exit 1 }
[System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
