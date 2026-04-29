@echo off
title StainBoost Companion
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies, please wait...
  call npm install
)
if not exist config.json (
  echo.
  echo ============================================
  echo  config.json not found.
  echo  Copy config.example.json to config.json
  echo  and paste your admin key.
  echo ============================================
  pause
  exit /b 1
)
node companion.js
pause
