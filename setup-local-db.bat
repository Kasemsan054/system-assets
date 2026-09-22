@echo off
chcp 65001 >nul
echo ========================================================
echo   Asset Management System - Setup Local Database (D1)
echo ========================================================
echo.
node init_local_db.js
pause
