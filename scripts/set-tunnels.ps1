param(
  [Parameter(Mandatory=$true)]
  [string]$BackendUrl,

  [Parameter(Mandatory=$true)]
  [string]$FrontendUrl
)

$Root = "$env:USERPROFILE\Desktop\songgi-joy"
$BackendUrl = $BackendUrl.Trim().TrimEnd("/")
$FrontendUrl = $FrontendUrl.Trim().TrimEnd("/")
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Backend URL:  $BackendUrl" -ForegroundColor Cyan
Write-Host "Frontend URL: $FrontendUrl" -ForegroundColor Cyan

# Frontend App.jsx ichida API_URL ni yangilash
$AppPath = "$Root\frontend\src\App.jsx"
$AppCode = Get-Content -Raw -Encoding UTF8 $AppPath
$AppCode = $AppCode -replace 'const API_URL = .*?;', "const API_URL = `"$BackendUrl`";"
[System.IO.File]::WriteAllText($AppPath, $AppCode, $Utf8NoBom)

# Frontend .env ham yozib qo‘yamiz
$FrontendEnv = "VITE_API_URL=$BackendUrl`r`n"
[System.IO.File]::WriteAllText("$Root\frontend\.env", $FrontendEnv, $Utf8NoBom)

# Backend .env ichida tokenni saqlab qolib, FRONTEND_URL ni yangilash
$BackendEnvPath = "$Root\backend\.env"
$OldEnv = ""
if (Test-Path $BackendEnvPath) {
  $OldEnv = Get-Content $BackendEnvPath -Raw
}

$TokenMatch = [regex]::Match($OldEnv, "(?m)^\s*BOT_TOKEN\s*=\s*([^\r\n]+)")
$Token = ""
if ($TokenMatch.Success) {
  $Token = $TokenMatch.Groups[1].Value.Trim()
}

$VoiceMatch = [regex]::Match($OldEnv, "(?m)^\s*VOICE_CHAT_URL\s*=\s*([^\r\n]*)")
$Voice = ""
if ($VoiceMatch.Success) {
  $Voice = $VoiceMatch.Groups[1].Value.Trim()
}

if (!$Token) {
  Write-Host "⚠️ BOT_TOKEN topilmadi. backend\.env faylga tokenni qo‘lda yozing." -ForegroundColor Yellow
  $Token = "PASTE_YOUR_BOT_TOKEN_HERE"
}

$NewBackendEnv = @"
BOT_TOKEN=$Token
FRONTEND_URL=$FrontendUrl
VOICE_CHAT_URL=$Voice
"@

[System.IO.File]::WriteAllText($BackendEnvPath, $NewBackendEnv, $Utf8NoBom)

Write-Host ""
Write-Host "✅ Tunnel linklar loyihaga yozildi." -ForegroundColor Green
Write-Host "Frontend API_URL yangilandi."
Write-Host "Backend FRONTEND_URL yangilandi."
Write-Host ""
Write-Host "Endi Frontend oynasida Vite o‘zi yangilanadi. Agar yangilanmasa Ctrl+C qilib npm run dev qiling."
Write-Host "Botni start-bot.ps1 bilan ishga tushiring."