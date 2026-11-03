@echo off
chcp 65001 >nul
title CRM Eccellenza - simulador
cd /d "%~dp0"

echo Preparando a versao final do CRM (leva uns 20 segundos)...
call npm run build
if errorlevel 1 (
  echo.
  echo Nao foi possivel preparar o CRM. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo CRM pronto. O navegador vai abrir em http://127.0.0.1:3000
echo Para desligar, feche esta janela.
start "" cmd /c "timeout /t 4 >nul & start http://127.0.0.1:3000"
call npm start
pause
