@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Dayflow
echo.
echo  ========================================
echo   Dayflow - local development launcher
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install Node.js 20+ from https://nodejs.org then try again.
  goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found on PATH.
  echo         Reinstall Node.js and ensure npm is available.
  goto :fail
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  Node  %NODE_VER%

if not exist "package.json" (
  echo [ERROR] package.json not found. Run this script from the Dayflow repo root.
  goto :fail
)

if not exist "node_modules\" (
  echo.
  echo  Installing dependencies ^(first run^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    goto :fail
  )
)

if not exist ".env.local" (
  echo.
  echo [WARN] .env.local is missing.
  if exist ".env.example" (
    copy /Y ".env.example" ".env.local" >nul
    echo        Created .env.local from .env.example.
    echo        Open .env.local and fill in your Supabase keys before signing in.
  ) else (
    echo        Copy .env.example to .env.local and add your Supabase keys.
  )
  echo        See RUN_GUIDE.md for full setup steps.
  echo.
)

echo.
echo  Starting Next.js at http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo.

start "" "http://localhost:3000"
call npm run dev
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" goto :fail
goto :eof

:fail
echo.
echo  Launch failed. See RUN_GUIDE.md or PROJECT_GUIDE.md for setup help.
echo.
pause
exit /b 1
