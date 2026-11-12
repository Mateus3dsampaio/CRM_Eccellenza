@echo off
chcp 65001 >nul
title CRM Eccellenza - simulador
cd /d "%~dp0"

echo Preparando a versao final do CRM (leva uns 20 segundos)...
rem Apaga os arquivos do preparo anterior: o OneDrive marca essa pasta e o build nao consegue apagar sozinho (erro EPERM).
if exist ".next\static" rmdir /s /q ".next\static"
if exist ".next\static" (
  echo.
  echo Nao foi possivel limpar o preparo anterior. Feche outro CRM aberto e tente de novo.
  pause
  exit /b 1
)
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
rem No computador o CRM roda como simulador (Simulador e relogio ligados).
set MODO_SIMULADOR=1
call npm start
pause
