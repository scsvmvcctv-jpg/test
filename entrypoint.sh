#!/bin/sh
set -e

# Optionally start background auth2.js Express server if enabled via env
if [ "$START_AUTH_SERVER" = "true" ]; then
    echo "Starting background auth2 Express server..."
    node auth2.js &
fi

# Start Next.js standalone application server
echo "Starting Next.js application on port ${PORT:-3000}..."
exec node server.js
