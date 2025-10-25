#!/bin/sh

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the bot
echo "Starting GUHD EATS bot..."
node src/index.js
