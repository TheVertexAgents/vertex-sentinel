#!/usr/bin/env bash
# stop-app.sh - Safely stops the Vertex Sentinel background services using graceful shutdown signals

# Change to the directory where the script is located
cd "$(dirname "$0")"

echo "╔═══════════════════════════════════════════════════╗"
echo "║          Stopping Vertex Sentinel Services        ║"
echo "╚═══════════════════════════════════════════════════╝"

stop_service() {
    local SERVICE_NAME=$1
    local PID_FILE="pids/${SERVICE_NAME}.pid"

    if [ ! -f "$PID_FILE" ]; then
        echo "ℹ️  $SERVICE_NAME is not currently running (no PID file)."
        return 0
    fi

    local TARGET_PID=$(cat "$PID_FILE")

    # Check if process is actually running
    if ! kill -0 "$TARGET_PID" 2>/dev/null; then
        echo "⚠️  $SERVICE_NAME (PID: $TARGET_PID) is already stopped. Cleaning up PID file."
        rm "$PID_FILE"
        return 0
    fi

    echo "🛑 Sending graceful shutdown signal (SIGTERM) to $SERVICE_NAME (PID: $TARGET_PID)..."
    
    # Send SIGTERM for graceful shutdown
    kill -15 "$TARGET_PID"

    # Best Practice: Wait for the process to actually exit
    local TIMEOUT=15
    local COUNT=0
    while kill -0 "$TARGET_PID" 2>/dev/null; do
        sleep 1
        COUNT=$((COUNT + 1))
        echo -n "."
        if [ "$COUNT" -ge "$TIMEOUT" ]; then
            echo -e "\n⏳ Graceful shutdown timed out for $SERVICE_NAME after ${TIMEOUT}s. Forcing shutdown..."
            kill -9 "$TARGET_PID" 2>/dev/null || true
            break
        fi
    done

    echo -e "\n✅ $SERVICE_NAME stopped successfully."
    rm "$PID_FILE"
}

# Stop in reverse order of initialization (optional, but good practice)
stop_service "dashboard"
stop_service "agent"

echo ""
echo "All services have been shut down."
