$Root = "$env:USERPROFILE\Desktop\songgi-joy"
$Cloudflared = "$env:USERPROFILE\cloudflared\cloudflared.exe"

function Open-ServiceWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='$Title'; $Command"
}

Write-Host "So‘nggi Joy local servislar ochilmoqda..." -ForegroundColor Cyan

Open-ServiceWindow "SJ Backend" "cd '$Root\backend'; npm run dev"
Start-Sleep -Seconds 2

Open-ServiceWindow "SJ Frontend" "cd '$Root\frontend'; npm run dev"
Start-Sleep -Seconds 2

Open-ServiceWindow "SJ Backend Tunnel 4000" "& '$Cloudflared' tunnel --url http://127.0.0.1:4000"
Start-Sleep -Seconds 2

Open-ServiceWindow "SJ Frontend Tunnel 5173" "& '$Cloudflared' tunnel --url http://127.0.0.1:5173"

Write-Host ""
Write-Host "✅ 4 ta oyna ochildi:" -ForegroundColor Green
Write-Host "1. Backend"
Write-Host "2. Frontend"
Write-Host "3. Backend Tunnel 4000"
Write-Host "4. Frontend Tunnel 5173"
Write-Host ""
Write-Host "Endi tunnel oynalaridan 2 ta https linkni oling:" -ForegroundColor Yellow
Write-Host "- 4000 oynasidagi link = BACKEND"
Write-Host "- 5173 oynasidagi link = FRONTEND"
Write-Host ""
Write-Host "Keyin set-tunnels.ps1 scriptini ishlating."