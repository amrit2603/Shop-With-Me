@echo off
setlocal
cd /d "%~dp0"
title VYUMI Shop With Me
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run this launcher again.
  pause
  exit /b 1
)
powershell.exe -NoProfile -NonInteractive -Command "try { $r = Invoke-RestMethod 'http://localhost:3001/api/health/live' -TimeoutSec 2; if ($r.status -eq 'alive') { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo VYUMI is already running on port 3001.
  echo Stop the older terminal with Ctrl+C, then run this launcher again.
  echo This prevents opening an older copy instead of your updated application.
  pause
  exit /b 1
)
if not exist "backend\package.json" (
  echo The backend files are missing. Extract the entire ZIP before starting VYUMI.
  goto failed
)
if not exist "frontend\package.json" (
  echo The frontend files are missing. Extract the entire ZIP before starting VYUMI.
  goto failed
)
if not exist "backend\node_modules\better-sqlite3\package.json" goto installBackend
if not exist "backend\node_modules\bcryptjs\package.json" goto installBackend
goto frontend
:installBackend
  echo Installing backend dependencies. This also works if a package lock was omitted during extraction.
call npm install --prefix backend --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto failed
:frontend
if not exist "frontend\node_modules\vite\package.json" (
  echo Installing frontend dependencies.
  call npm install --prefix frontend --no-audit --no-fund
  if errorlevel 1 goto failed
)
echo Building the current application...
call npm run build
if errorlevel 1 goto failed
echo Open http://localhost:3001 once the server reports it is running.
echo Keep this window open while using VYUMI. Press Ctrl+C to stop the server.
node backend/src/server.js
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo VYUMI could not start. The error is shown above.
pause
exit /b 1
