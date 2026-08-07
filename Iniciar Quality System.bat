@echo off
setlocal

title Inicializador - Quality System

set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%"

echo.
echo ==========================================
echo         INICIANDO QUALITY SYSTEM
echo ==========================================
echo.

if not exist "%BACKEND_DIR%\package.json" (
    echo ERRO: Backend nao encontrado.
    echo Caminho esperado:
    echo %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo ERRO: Frontend nao encontrado.
    echo Caminho esperado:
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

echo [1/4] Criando backup de seguranca...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\backup-database.ps1"

echo [2/4] Iniciando Backend...
start "Quality System - Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && npm start"

timeout /t 3 /nobreak >nul

echo [3/4] Iniciando Frontend...
start "Quality System - Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev -- --port 5173 --strictPort"

timeout /t 5 /nobreak >nul

echo [4/4] Abrindo sistema...
start "" "http://localhost:5173"

exit
