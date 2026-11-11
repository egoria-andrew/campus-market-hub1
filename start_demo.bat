@echo off
cd /d "%~dp0"
title Campus Market Hub Demo Server
echo Starting Campus Market Hub demo...
echo Keep this window open while using the demo.
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py
) else (
  python server.py
)
echo.
echo The demo server stopped. If an error appeared above, check that Python 3 is installed and port 8000 is free.
pause
