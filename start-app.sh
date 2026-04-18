#!/usr/bin/env bash
# start-app.sh - Safely starts the Vertex Sentinel application and dashboard in the background

# Fail on error
set -e

# Change to the directory where the script is located
cd "$(dirname "$0")"

# Best Practice: Ensure we have necessary directories
mkdir -p logs pids

echo "╔═══════════════════════════════════════════════════╗"
echo "║          Starting Vertex Sentinel Services        ║"
echo "╚═══════════════════════════════════════════════════╝"

# Check for .env file
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found. Please create one from .env.example."
    exit 1
fi

start_service() {
    local SERVICE_NAME=$1
    local START_COMMAND=$2
    local PID_FILE="pids/${SERVICE_NAME}.pid"
    local LOG_FILE="logs/${SERVICE_NAME}.log"

    # Best Practice: Guarantee no double-start
    if [ -f "$PID_FILE" ]; then
        local PREV_PID=$(cat "$PID_FILE")
        if kill -0 "$PREV_PID" 2>/dev/null; then
            echo "⚠️  $SERVICE_NAME is already running (PID: $PREV_PID). Skipping."
            return 0
        else
            echo "🧹 Cleaning up stale PID file for $SERVICE_NAME."
            rm "$PID_FILE"
        fi
    fi

    echo "🚀 Starting $SERVICE_NAME..."
    # Execute the command in the background, redirecting stdout and stderr
    # Using 'nohup' protects against the process dying if the terminal closes
    nohup $START_COMMAND > "$LOG_FILE" 2>&1 &
    local NEW_PID=$!
    
    # Save the new Process ID
    echo "$NEW_PID" > "$PID_FILE"
    echo "✅ $SERVICE_NAME started (PID: $NEW_PID). Logs at $LOG_FILE"
}

# Start the Agent Brain (Trading Logic)
start_service "agent" "npm run start"

# Start the Live Dashboard
start_service "dashboard" "npm run dashboard"

echo ""
echo "All requested services have been started in the background."
echo "Use './stop-app.sh' to gracefully shut them down."
echo ""
echo "🔍 How to verify the services are running:"
echo "  1. Monitor Agent Logs:      tail -f logs/agent.log"
echo "  2. Monitor Dashboard Logs:  tail -f logs/dashboard.log"
echo "  3. View Dashboard UI:       http://localhost:3000/dashboard/index.html"
echo "  4. Check process status:    ps -p \$(cat pids/agent.pid) \$(cat pids/dashboard.pid)"
