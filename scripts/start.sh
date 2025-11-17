#!/bin/sh

# Railway-optimized startup script for Roulette System
set -e

# Set default DATABASE_URL if not provided
export DATABASE_URL=${DATABASE_URL:-"file:/data/guhdeats.db"}
export NODE_ENV=${NODE_ENV:-"production"}
export PORT=${PORT:-"3000"}
export HEALTH_PORT=${HEALTH_PORT:-"3001"}

echo "🚀 Starting Railway-optimized Roulette System..."
echo "📦 Environment: $NODE_ENV"
echo "🗄️  Database: $DATABASE_URL"
echo "🌐 Port: $PORT"

# Create data directory for SQLite if it doesn't exist
mkdir -p /data

# Generate Prisma client - MUST be in binary mode (not Data Proxy) for SQLite
echo "🔧 Generating Prisma client..."
# [FIX]: Force binary engine mode and disable Data Proxy before generation
export PRISMA_CLIENT_ENGINE_TYPE=binary
export PRISMA_GENERATE_DATAPROXY=false
export PRISMA_QUERY_ENGINE_TYPE=binary
export PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# Generate WITHOUT --no-engine flag to ensure proper binary engine generation
if ! npx prisma generate; then
  echo "⚠️  Prisma client generation failed, continuing..."
fi

# Run database migrations with timeout
echo "🗄️  Running database migrations..."
timeout 30s npx prisma migrate deploy || {
  echo "⚠️  Database migrations failed, but continuing startup..."
}

# Validate native modules before launch
if [ -f "/app/scripts/prebuild-validate.cjs" ]; then
  echo "🧪 Verifying native module integrity..."
  if ! node /app/scripts/prebuild-validate.cjs --verify-only; then
    echo "🩹 Attempting automated repair of native modules..."
    if ! node /app/scripts/prebuild-validate.cjs; then
      echo "❌ Unable to repair native modules automatically."
      exit 1
    fi
  fi
fi

# Pre-startup validation for Railway
echo "🔍 Running Railway startup validation..."
if [ -f "/health-check.js" ]; then
  echo "🏥 Starting health check server in background..."
  node /health-check.js &
  HEALTH_PID=$!

  # Wait for health check to be ready
  echo "⏳ Waiting for health check server..."
  for i in $(seq 1 30); do
    if curl -f -s http://localhost:${HEALTH_PORT}/health >/dev/null 2>&1; then
      echo "✅ Health check server is ready"
      break
    fi
    if [ $i -eq 30 ]; then
      echo "⚠️  Health check server failed to start, continuing..."
    fi
    sleep 1
  done
fi

# Pre-flight validation
echo "🛫 Running pre-flight checks..."
if [ -f "./dist/src/index.js" ]; then
  echo "✅ Application bundle found at ./dist/src/index.js"
elif [ -f "/app/dist/src/index.js" ]; then
  echo "✅ Application bundle found at /app/dist/src/index.js"
elif [ -f "dist/index.js" ]; then
  echo "✅ Application bundle found at dist/index.js (using alternative entry)"
  export ALT_ENTRY=true
else
  echo "❌ Application bundle not found in expected locations!"
  echo "   Checked: ./dist/src/index.js, /app/dist/src/index.js, dist/index.js"
  echo "   Listing /app/dist contents:"
  ls -la /app/dist 2>/dev/null || echo "   /app/dist does not exist"
  echo "   Listing ./dist contents:"
  ls -la ./dist 2>/dev/null || echo "   ./dist does not exist"
  exit 1
fi

# Check critical dependencies
echo "🔍 Validating critical dependencies..."
node -e "
try {
  require('canvas');
  console.log('✅ Canvas: OK');
} catch (e) {
  console.error('❌ Canvas: FAILED -', e.message);
  process.exit(1);
}

try {
  require('sharp');
  console.log('✅ Sharp: OK');
} catch (e) {
  console.error('❌ Sharp: FAILED -', e.message);
  process.exit(1);
}

try {
  require('@prisma/client');
  console.log('✅ Prisma Client: OK');
} catch (e) {
  console.error('❌ Prisma Client: FAILED -', e.message);
  process.exit(1);
}

console.log('🎯 All critical dependencies validated');
"

# Start the bot with Railway optimizations
echo "🎮 Starting Roulette System..."
echo "📝 Logs will be available in Railway dashboard"
echo "🏥 Health check: http://localhost:${HEALTH_PORT}/health"
echo "⏰ Starting at $(date)"

# Start the main application
exec node dist/src/index.js
