@echo off
echo =========================================
echo Starting Smart Subject Lift Project...
echo =========================================

echo Starting FastAPI Backend...
start cmd /k "cd backend && uvicorn main:app --reload"

echo Starting React Frontend...
start cmd /k "cd frontend && npm run dev"

echo Both servers are starting up in new windows.
echo You can now safely close this window.
pause
