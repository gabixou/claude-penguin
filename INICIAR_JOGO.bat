@echo off
title Club Penguin Browser - Modo Performance (build + preview)
echo ========================================================
echo   MODO PERFORMANCE: build de producao + vite preview
echo ========================================================
echo.

REM --- Se ja estiver no ar, nao sobe duplicata (evita "port in use") ---
powershell -NoProfile -Command "try { (Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
  echo [INFO] localhost:3000 ja esta respondendo - servidor parece no ar.
  echo        Pulando build e subida. Abrindo o jogo...
  start http://localhost:3000
  pause
  exit /b 0
)

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
cd /d %~dp0

echo.
echo Iniciando o Servidor WebSocket na porta 8080...
REM /k mantem a janela aberta se der erro (antes /c fechava e escondia a causa)
start "Club Penguin Server" cmd /k "cd /d %~dp0server && node src/index.js"

echo Aguardando 2 segundos...
timeout /t 2 /nobreak >nul

echo Iniciando o preview de producao na porta 3000...
start "Club Penguin Client (preview)" cmd /k "cd /d %~dp0client && npx vite preview --port 3000 --strictPort"

echo Aguardando 5 segundos...
timeout /t 5 /nobreak >nul

REM --- Confere se o preview subiu antes de abrir o navegador ---
powershell -NoProfile -Command "try { (Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
  echo Abrindo o jogo no Google Chrome...
  start http://localhost:3000
  echo.
  echo [PRONTO!] Modo performance ativo em http://localhost:3000
) else (
  echo.
  echo [ERRO] O preview NAO respondeu em localhost:3000.
  echo        Olhe a janela "Club Penguin Client (preview)" - o erro esta la.
  echo        Causa comum: porta 3000 ocupada por outro processo.
)
echo Mantenha as janelas do console abertas enquanto estiver jogando.
echo ========================================================
pause
