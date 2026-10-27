@echo off
setlocal
cd /d "%~dp0"

curl.exe --silent --fail --max-time 2 "http://127.0.0.1:5000/health" | findstr /C:"news-detector-api" >nul
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

if not exist ".venv\Scripts\python.exe" (
    where py >nul 2>nul
    if not errorlevel 1 (
        py -3 -m venv .venv
    ) else (
        python -m venv .venv
    )
    if errorlevel 1 goto setup_failed
)

".venv\Scripts\python.exe" -c "import flask, joblib, pandas, sklearn" >nul 2>nul
if errorlevel 1 (
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto setup_failed
)

echo Starting Fake News Detector...
echo Open http://127.0.0.1:5000/app/ when Flask reports that it is running.
echo Keep this command window open while using the app.
".venv\Scripts\python.exe" app.py
if errorlevel 1 goto setup_failed
exit /b 0

:setup_failed
echo.
echo Setup or Flask startup failed. Read the error shown above.
pause
exit /b 1
