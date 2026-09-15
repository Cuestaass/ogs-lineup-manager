@echo off
setlocal
set "APP=%~dp0app\index.html"
where msedge.exe >nul 2>nul
if %errorlevel%==0 (
  start "FC OGS" msedge.exe --app="file:///%APP:\=/%"
  exit /b
)
where chrome.exe >nul 2>nul
if %errorlevel%==0 (
  start "FC OGS" chrome.exe --app="file:///%APP:\=/%"
  exit /b
)
start "FC OGS" "%APP%"
