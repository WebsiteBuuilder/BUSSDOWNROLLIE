# ---------- Builder: install dev deps and build TS ----------
FROM node:20-bookworm-slim AS builder

# Recommended: avoid npm update nags and speed up ci
ENV npm_config_fund=false \
    npm_config_audit=false

WORKDIR /app

# Install build toolchain needed for native modules during build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy lockfiles FIRST for better Docker layer caching
COPY package.json package-lock.json ./

# If lockfile is in sync, this will succeed; otherwise npm ci errors out.
# We want a deterministic install in the builder with dev deps included.
RUN npm ci --include=dev

# Copy the rest of the source and build
COPY . .
RUN npm run build

# Prune to production dependencies after build to keep runtime small
RUN npm prune --omit=dev

# ---------- Runtime: small image with only prod deps & compiled JS ----------
FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production \
    npm_config_fund=false \
    npm_config_audit=false \
    DATABASE_URL=file:/data/guhdeats.db

WORKDIR /app

# Install OpenSSL for Prisma compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy only what we need at runtime
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy startup script
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

# Default command - fixed for Railway compatibility
CMD ["/start.sh"]
