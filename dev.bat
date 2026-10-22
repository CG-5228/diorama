@echo off
title Diorama - Viewer

echo ========================================================
echo   Diorama - Viewer
echo   URL: http://localhost:5173
echo ========================================================
echo.

:: Check if Vite dev server is already running on port 5173
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
  echo Dev server already running! Opening the Diorama viewer in the browser...
  start http://localhost:5173
  exit /b
)

echo Starting dev server and opening the Diorama viewer...
timeout /t 2 /nobreak >nul
start http://localhost:5173
npm run view
