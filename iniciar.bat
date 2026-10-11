@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORTA=8080
where python >nul 2>nul
if %errorlevel%==0 (
  echo Meu treino em http://localhost:%PORTA%  ^(Ctrl+C para parar^)
  start "" "http://localhost:%PORTA%"
  python -m http.server %PORTA%
  goto :fim
)
where py >nul 2>nul
if %errorlevel%==0 (
  echo Meu treino em http://localhost:%PORTA%  ^(Ctrl+C para parar^)
  start "" "http://localhost:%PORTA%"
  py -m http.server %PORTA%
  goto :fim
)
echo Python nao foi encontrado.
echo Instale em https://www.python.org/downloads/ ou publique no GitHub Pages.
:fim
pause
