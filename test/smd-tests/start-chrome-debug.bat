@echo off
REM ==============================================================
REM Launches a SEPARATE Chrome instance with its own profile dir
REM and remote debugging on port 9222.
REM
REM Your main Chrome (with esokullu@gmail.com, your tabs, etc.)
REM stays open and untouched. The debug Chrome is a second window
REM you log into the test sites in ONCE; cookies persist forever.
REM
REM Why a separate profile? Chrome cannot enable the debug port on
REM a profile that's already in use, and Chrome 127+ encrypts
REM cookies with App-Bound Encryption so we can't read them from
REM your main profile externally.
REM ==============================================================

setlocal

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
    echo Chrome not found. Edit this file to set CHROME=path\to\chrome.exe
    pause
    exit /b 1
)

set "DEBUG_PROFILE=%USERPROFILE%\chrome-debug-profile"

echo Launching Chrome with:
echo   --remote-debugging-port=9222
echo   --user-data-dir="%DEBUG_PROFILE%"
echo.
echo Your main Chrome is NOT affected. This is a second window with
echo its own profile. Log into the test sites the first time; cookies
echo persist between runs.
echo.

start "" "%CHROME%" --remote-debugging-port=9222 --user-data-dir="%DEBUG_PROFILE%"

echo Done. You can now run:  python test_smd.py
endlocal
