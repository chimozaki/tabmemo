@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  pause
  exit /b 1
)

curl.exe --silent --fail http://localhost:4174/api/health >nul 2>&1
if not errorlevel 1 goto open_app

start "TabMemo Local Server" /min cmd /k "cd /d ""%~dp0"" && node server.js"

for /l %%I in (1,1,30) do (
  curl.exe --silent --fail http://localhost:4174/api/health >nul 2>&1
  if not errorlevel 1 goto open_app
  timeout /t 1 /nobreak >nul
)

echo TabMemo local server did not start within 30 seconds.
pause
exit /b 1

:open_app
start "" http://localhost:4174/
exit /b 0
