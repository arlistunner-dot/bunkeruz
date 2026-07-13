$Root = "$env:USERPROFILE\Desktop\songgi-joy"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='SJ Telegram Bot'; cd '$Root\backend'; npm run bot"

Write-Host "✅ Bot oynasi ochildi." -ForegroundColor Green