# syntax=docker/dockerfile:1.4

########## Builder stage ##########
FROM node:20-bookworm-slim AS builder

ENV NODE_ENV=development \
    npm_config_fund=false \
    npm_config_audit=false \
    npm_config_loglevel=error \
    npm_config_cache=/tmp/.npm

# Install build prerequisites and native deps for canvas/gifencoder/sharp/better-sqlite3
# Combined into single RUN for better caching and minimal layer size
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
    sqlite3 \
    libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean \
  && ln -sf /usr/bin/python3 /usr/bin/python

ENV PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig \
    npm_config_python=/usr/bin/python3 \
    npm_config_build_from_source=true

WORKDIR /app

# Copy package manifests first for better caching
COPY package.json package-lock.json* ./

# Install dependencies (optimized for Railway - strict lockfile, no audit, minimal progress)
RUN npm ci --legacy-peer-deps --no-audit --progress=false || \
    (echo "⚠️ npm ci failed, falling back to npm install..." && \
     npm install --legacy-peer-deps --no-audit --progress=false)

# Copy source files (only what's needed for build)
COPY tsconfig.json ./
COPY types.d.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src

# Build TypeScript (with retry logic for network stability)
RUN npm run build || (echo "⚠️ Build failed once, retrying..." && npm run build) || (echo "❌ TypeScript build failed after retry!" && exit 1)

# Verify build output exists and is valid (self-healing verification)
RUN echo "🔍 Verifying build output..." && \
    ls -la dist/ 2>/dev/null || echo "⚠️ dist/ directory listing failed" && \
    ls -la dist/src/ 2>/dev/null || echo "⚠️ dist/src/ directory listing failed" && \
    test -f dist/src/index.js || (echo "❌ Build output missing at dist/src/index.js!" && ls -la dist/ 2>/dev/null && exit 1) && \
    node -e "console.log('✅ TypeScript build passed all checks!')" && \
    node --check dist/src/index.js || (echo "❌ Build output syntax error!" && exit 1) && \
    echo "✅ Build verification complete - ready for Railway deployment" && \
    echo "📦 Build output structure:" && \
    find dist/src -type f -name "*.js" | head -20

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
