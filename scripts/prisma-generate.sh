#!/bin/sh
# Prisma client generation script - ensures binary engine mode (not Data Proxy)
# This script is called from package.json postinstall

export PRISMA_CLIENT_ENGINE_TYPE=binary
export PRISMA_GENERATE_DATAPROXY=false
export PRISMA_QUERY_ENGINE_TYPE=binary
export PRISMA_CLI_QUERY_ENGINE_TYPE=binary

echo "🔧 Generating Prisma client in binary mode (not Data Proxy)..."
npx prisma generate

