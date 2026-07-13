Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "✅ Node processlar to‘xtatildi." -ForegroundColor Green