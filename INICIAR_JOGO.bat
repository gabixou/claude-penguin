@echo off
title Club Penguin Browser - Inicializador
echo ========================================================
echo        PENGUIN BROWSER - SERVIDOR E CLIENTE LOCAL
echo ========================================================
echo.
echo Iniciando o Servidor WebSocket na porta 8080...
start "Club Penguin Server" cmd /c "cd /d %~dp0server && node src/index.js"

echo Aguardando 2 segundos...
timeout /t 2 /nobreak >nul

echo Iniciando o Cliente Web Vite na porta 3000...
start "Club Penguin Client" cmd /c "cd /d %~dp0client && npx vite --port 3000"

echo Aguardando 3 segundos...
timeout /t 3 /nobreak >nul

echo Abrindo o jogo no Google Chrome...
start http://localhost:3000

echo.
echo [TUDO PRONTO!] O jogo foi iniciado em http://localhost:3000
echo Mantenha as janelas do console abertas enquanto estiver jogando.
echo ========================================================
pause
