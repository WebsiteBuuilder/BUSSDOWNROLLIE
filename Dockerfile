# syntax=docker/dockerfile:1.4

########## Builder stage ##########
FROM node:20-bookworm-slim AS builder

ENV NODE_ENV=development \
    npm_config_fund=false \
    npm_config_audit=false \
    npm_config_loglevel=error \
    npm_config_cache=/tmp/.npm

# Install build prerequisites and native deps for canvas/gifencoder/sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpixman-1-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first for better caching
COPY package.json package-lock.json* ./

# Resilient dependency installation with fallbacks
RUN npm ci || npm install --legacy-peer-deps || npm install --force --legacy-peer-deps

# Ensure native bindings are compiled
RUN npm rebuild --build-from-source canvas && \
    (npm rebuild sharp || true)

# Copy the rest of the project
COPY . .

# Validate native modules and build the project
RUN node scripts/prebuild-validate.cjs && npm run build

# Ensure build output exists
RUN test -f dist/src/index.js

# Remove devDependencies for slimmer runtime image
RUN npm prune --omit=dev && npm cache clean --force

########## Runtime stage ##########
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    npm_config_fund=false \
    npm_config_audit=false \
    DATABASE_URL=file:/data/guhdeats.db \
    PORT=3000

# Install runtime libraries for native modules
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

# Copy production artifacts
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

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
