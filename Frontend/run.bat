@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  py -3.14 -m venv .venv
  if errorlevel 1 goto setup_failed
)

".venv\Scripts\python.exe" -c "import flask, joblib, pandas, sklearn" >nul 2>nul
if errorlevel 1 (
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto setup_failed
)

".venv\Scripts\python.exe" app.py
if errorlevel 1 goto setup_failed
exit /b 0

:setup_failed
echo.
echo Setup or Flask startup failed. Read the error shown above.
pause
exit /b 1