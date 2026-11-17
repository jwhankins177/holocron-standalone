@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Extract the whole Holocron folder before starting.
  pause
  exit /b 1
)
if not exist "runtime\node.exe" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo Run npm install and npm run build with Node.js 24, or use the prebuilt package.
    pause
    exit /b 1
  )
  set "HOLOCRON_NODE=node"
) else (
  set "HOLOCRON_NODE=runtime\node.exe"
)
"%HOLOCRON_NODE%" launch.mjs
if errorlevel 1 pause
