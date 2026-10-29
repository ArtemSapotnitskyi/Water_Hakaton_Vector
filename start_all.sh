#!/bin/bash
# Start script for HydroPulse SCADA Dashboard

echo "=========================================================="
echo " Starting HydroPulse Water SCADA Twin & Anomaly Dashboard "
echo "=========================================================="

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export PATH="$HOME/.local/bin:$PATH"

# Auto-initialize .env if missing
if [ ! -f "$DIR/.env" ] && [ -f "$DIR/.env.example" ]; then
    echo "Creating .env from .env.example..."
    cp "$DIR/.env.example" "$DIR/.env"
fi

# 1. Start Backend
echo "Starting Backend on http://localhost:8000 ..."
cd "$DIR/backend"
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 2. Start Frontend
echo "Starting Frontend on http://localhost:5173 ..."
cd "$DIR/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo "Systems active!"
echo "Open browser at: http://localhost:5173"
echo "Press Ctrl+C to terminate both servers."

trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM EXIT
wait
