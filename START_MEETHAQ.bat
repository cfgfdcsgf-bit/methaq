@echo off
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is not installed. Install Node.js and pnpm first.
  pause
  exit /b 1
)

if not exist .env (
  echo .env is missing. Copy .env.example to .env and set DATABASE_URL and OWNER_EMAIL.
  pause
  exit /b 1
)

if not exist node_modules (
  call pnpm install
  if errorlevel 1 goto :failed
)

call pnpm db:migrate
if errorlevel 1 (
  echo Database setup failed. Check DATABASE_URL in .env and try again.
  pause
  exit /b 1
)

echo Starting Meethaq. Use the port shown in the server log.
call pnpm dev
set "MEETHAQ_EXIT=%ERRORLEVEL%"
pause
exit /b %MEETHAQ_EXIT%

:failed
echo Dependency installation failed. Check your internet connection and try again.
pause
exit /b 1
