@echo off
rem Start mySpotify. Double-click this file, or run it from a terminal.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 myspotify.py %*
  goto :end
)
python --version >nul 2>nul
if %errorlevel%==0 (
  python myspotify.py %*
  goto :end
)
echo Python 3 is not installed.
echo Install it with:  winget install Python.Python.3.13
echo or from https://www.python.org/downloads/  (tick "Add python.exe to PATH"), then run start.cmd again.
:end
pause
