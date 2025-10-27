#!/bin/sh

# Set default DATABASE_URL if not provided
export DATABASE_URL=${DATABASE_URL:-"file:/data/guhdeats.db"}

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Validate roulette dependencies (non-fatal)
echo "Validating roulette dependencies..."
node scripts/validate-roulette-deps.js || echo "⚠️  Roulette validation warning (non-fatal)"

# Start the bot
echo "Starting GUHD EATS bot..."
node dist/src/index.js
