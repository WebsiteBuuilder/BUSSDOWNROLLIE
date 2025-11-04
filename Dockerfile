# syntax=docker/dockerfile:1.4

########## Builder stage ##########
FROM node:20-bookworm-slim AS builder

ENV NODE_ENV=development \
    npm_config_fund=false \
    npm_config_audit=false \
    npm_config_loglevel=error \
    npm_config_cache=/tmp/.npm

# Install build prerequisites and native deps for canvas/gifencoder/sharp
# Combined into single RUN for better caching
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    git \
    g++ \
    make \
    pkg-config \
    python3 \
    python3-pip \
    libcairo2-dev \
    libpixman-1-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libpng-dev \
    libgif-dev \
    librsvg2-dev \
    libfreetype6-dev \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/python3 /usr/bin/python

ENV PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig \
    npm_config_python=/usr/bin/python3 \
    npm_config_build_from_source=true

WORKDIR /app

# Copy package manifests first for better caching
COPY package.json package-lock.json* ./

# Install dependencies with better caching
# Use npm ci for faster, reproducible installs (omit dev to reduce size)
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source files (only what's needed for build)
COPY tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src

# Build TypeScript (validation happens at runtime, not during build)
RUN npm run build || (echo "Build failed!" && exit 1)

# Ensure build output exists
RUN test -f dist/src/index.js || (echo "❌ Build output missing!" && exit 1)

########## Runtime stage ##########
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    npm_config_fund=false \
    npm_config_audit=false \
    DATABASE_URL=file:/data/guhdeats.db \
    PORT=3000

# Install runtime libraries for native modules (minimal set)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpixman-1-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    openssl \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production artifacts only
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Copy startup helpers
COPY scripts/start.sh /start.sh
COPY scripts/health-check.js /health-check.js
RUN chmod +x /start.sh /health-check.js

# Non-root execution for Railway
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app /start.sh /health-check.js
USER appuser

EXPOSE 3000

# Entrypoint
CMD ["/start.sh"]
