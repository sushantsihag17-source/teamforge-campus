@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting TeamForge in a separate window...
start "TeamForge Server" /min cmd /k "node server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
echo TeamForge should now be open in your browser.
echo Close the "TeamForge Server" window to stop the application.
pause
