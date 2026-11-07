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
  pnpm install
  if errorlevel 1 goto :failed
)

pnpm db:push
if errorlevel 1 (
  echo Database setup failed. Check DATABASE_URL in .env and try again.
  pause
  exit /b 1
)

echo Opening Meethaq at http://localhost:5000
pnpm dev
pause
exit /b 0

:failed
echo Dependency installation failed. Check your internet connection and try again.
pause
exit /b 1
