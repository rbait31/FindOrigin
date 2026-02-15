# Проверка туннеля с заголовком Bypass-Tunnel-Reminder (обход страницы localtunnel).
# Использование: .\scripts\check-tunnel.ps1 "https://ВАШ-ИД.loca.lt/api/webhook"
param([Parameter(Mandatory=$true)][string]$TunnelUrl)

$headers = @{ "Bypass-Tunnel-Reminder" = "1" }
try {
  $r = Invoke-RestMethod -Uri $TunnelUrl -Method Get -Headers $headers
  Write-Host "OK:" $r
} catch {
  Write-Host "Ошибка:" $_.Exception.Message
  Write-Host "Localtunnel часто даёт 503. Для бота надёжнее задеплоить на Vercel."
}
