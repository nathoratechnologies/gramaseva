@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Gramaseva - publishing to Firebase
echo ============================================
echo.
echo [1/3] Google login (a browser window will open - choose your account and click Allow)
call npx --yes firebase-tools login
echo.
echo [2/3] Installing new parts (only first time) and building the app...
call npm install --no-audit --no-fund
call npm run build
if errorlevel 1 (echo BUILD FAILED - send a screenshot of this window to Claude & pause & exit /b 1)
echo.
echo [3/3] Uploading to Firebase...
call npx --yes firebase-tools deploy
if errorlevel 1 (echo DEPLOY FAILED - send a screenshot of this window to Claude & pause & exit /b 1)
echo.
echo DONE! Open this on your phone:  https://gramaseva-b2724.web.app
pause
