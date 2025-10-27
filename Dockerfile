# ---------- Builder: install dev deps and build TS ----------
FROM node:20-bookworm-slim AS builder

# Recommended: avoid npm update nags and speed up ci
ENV npm_config_fund=false \
    npm_config_audit=false

WORKDIR /app

# Install build toolchain + canvas native dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

# Copy lockfiles FIRST for better Docker layer caching
COPY package.json package-lock.json ./

# Self-healing npm install. If ci fails, rebuild lockfile and try again.
RUN if ! npm ci --include=dev; then \
      echo "Lockfile out of sync, rebuilding..." && \
      rm -f package-lock.json && \
      npm install --include=dev && \
      npm ci --include=dev; \
    fi

# Post-install sanity check for canvas
RUN node -e "require('canvas'); console.log('✅ Canvas linked OK')"

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

# Install runtime libraries for canvas + OpenSSL for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

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
