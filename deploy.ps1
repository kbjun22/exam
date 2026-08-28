# 2026 청소년상담사 1급 CBT - GitHub Push Script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "2026 청상1급 CBT - GitHub 업로드 도우미"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  2026 청소년상담사 1급 CBT 웹앱 - GitHub (kbjun22/exam) 푸시" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

Write-Host "[1단계] Git 상태 및 원격 저장소 확인..." -ForegroundColor Yellow
git branch -M main
git remote -v
Write-Host ""

Write-Host "[2단계] GitHub에 코드를 업로드(Push)합니다..." -ForegroundColor Yellow
Write-Host "(브라우저 로그인 팝업창이 뜨면 로그인을 진행해 주세요)" -ForegroundColor Gray
Write-Host ""

git push -u origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  [성공!] GitHub (kbjun22/exam)에 main 브랜치 업로드 완료!" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  이제 GitHub Pages 설정 페이지를 새로고침(F5)하시면" -ForegroundColor White
    Write-Host "  Branch 목록에 'main'이 정상적으로 나타납니다!" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. https://github.com/kbjun22/exam/settings/pages 접속" -ForegroundColor Cyan
    Write-Host "  2. Branch: 'main' / '/(root)' 선택 후 [Save] 클릭" -ForegroundColor Cyan
    Write-Host "  3. 모바일 접속 주소: https://kbjun22.github.io/exam/" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Red
    Write-Host "  [안내] 푸시 도중 문제가 발생했습니다." -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Red
    Write-Host "  저장소가 생성되어 있는지 확인해 주세요: https://github.com/kbjun22/exam" -ForegroundColor White
    Write-Host ""
}

Write-Host "종료하려면 아무 키나 누르세요..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
