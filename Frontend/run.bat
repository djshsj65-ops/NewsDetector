@echo off
setlocal
cd /d "%~dp0"

curl.exe --silent --show-error --fail --max-time 2 "http://127.0.0.1:5000/health" | findstr /C:"news-detector-api" >nul
if not errorlevel 1 (
    echo Fake News Detector is already running at http://127.0.0.1:5000/app/
    start "" "http://127.0.0.1:5000/app/"
    exit /b 0
)

set "PORT_PID="
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":5000 .*LISTENING"') do set "PORT_PID=%%P"
if defined PORT_PID (
    echo Port 5000 is already in use by process %PORT_PID%, but it is not responding as this app.
    echo Close that specific program or choose another port before starting Flask.
    pause
    exit /b 1
)

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON=py -3"
) else (
    set "PYTHON=python"
)

echo Starting Fake News Detector with %PYTHON%...
echo When Flask reports that it is running, open http://127.0.0.1:5000/app/
echo Keep this window open while using the app.
%PYTHON% app.py
if errorlevel 1 (
    echo Flask stopped with an error. Check the message above before trying again.
    echo Install the project dependencies with: py -m pip install -r requirements.txt
    pause
)
