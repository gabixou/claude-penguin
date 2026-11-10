@echo off
title Club Penguin Browser - Modo Performance (build + preview)
echo ========================================================
echo   MODO PERFORMANCE: build de producao + vite preview
echo   (rode INICIAR_JOGO.bat se quiser o modo dev/HMR)
echo ========================================================
echo.

if not exist server\node_modules (
  echo Instalando dependencias do servidor...
  cd /d %~dp0server && npm install
  cd /d %~dp0
)

echo Compilando cliente (vite build)...
cd /d %~dp0client && npm run build
if errorlevel 1 (
  echo ERRO no build. Abortando.
  pause
  exit /b 1
)

echo.
echo Iniciando o Servidor WebSocket na porta 8080...
start "Club Penguin Server" cmd /c "cd /d %~dp0server && node src/index.js"

echo Aguardando 2 segundos...
timeout /t 2 /nobreak >nul

echo Iniciando o preview de producao na porta 3000...
start "Club Penguin Client (preview)" cmd /c "cd /d %~dp0client && npx vite preview --port 3000 --strictPort"

echo Aguardando 3 segundos...
timeout /t 3 /nobreak >nul

echo Abrindo o jogo no Google Chrome...
start http://localhost:3000

echo.
echo [PRONTO!] Modo performance ativo em http://localhost:3000
echo Mantenha as janelas do console abertas enquanto estiver jogando.
echo ========================================================
pause
