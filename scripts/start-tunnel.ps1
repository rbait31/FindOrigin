# Запускает localtunnel в новом окне PowerShell.
# Туннель будет работать, пока окно не закрыть.
# URL смотрите в открывшемся окне, затем вызовите setWebhook с этим URL.

$projectRoot = Split-Path -Parent $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Tunnel running. Do not close this window.' -ForegroundColor Green; npm run tunnel"
