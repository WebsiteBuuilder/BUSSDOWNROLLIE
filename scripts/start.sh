#!/bin/sh

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the bot
echo "Starting GUHD EATS bot..."
node dist/src/index.js
