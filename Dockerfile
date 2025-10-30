# ---------- Builder: install dev deps and build TS ----------
FROM node:20-bookworm-slim AS builder

# Recommended: avoid npm update nags and speed up ci
ENV npm_config_fund=false \
    npm_config_audit=false \
    npm_config_loglevel=error \
    npm_config_cache=/tmp/.npm

# Install comprehensive build toolchain + canvas native dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copy lockfiles FIRST for better Docker layer caching
COPY package.json package-lock.json ./

# Self-healing npm install with multiple fallback strategies
RUN echo "🚀 [Docker] Installing dependencies with self-healing..." && \
    npm ci --include=dev --prefer-offline --no-audit --no-fund --ignore-scripts 2>/dev/null || \
    (echo "🔧 [Docker] Lockfile out of sync, rebuilding..." && \
     npm install --include=dev --prefer-offline --no-audit --no-fund --legacy-peer-deps) || \
    (echo "🆘 [Docker] Legacy peer deps failed, trying force install..." && \
     npm install --include=dev --force --legacy-peer-deps) || \
    (echo "🆘 [Docker] All install methods failed, exiting" && \
     exit 1)

# Ensure all critical dependencies are present and functional
RUN echo "🔍 [Docker] Validating critical dependencies..." && \
    npm ls canvas gifencoder sharp 2>/dev/null || \
    (echo "🆘 [Docker] Some dependencies missing, reinstalling..." && \
     npm install canvas gifencoder sharp --save --legacy-peer-deps)

# Post-install sanity check with detailed error reporting
RUN echo "✅ [Docker] Running post-install validation..." && \
    node -e "try{require('canvas'); console.log('✅ Canvas linked OK')}catch(e){console.error('❌ Canvas failed:', e); process.exit(1)}" && \
    node -e "try{require('sharp'); console.log('✅ Sharp linked OK')}catch(e){console.error('❌ Sharp failed:', e); process.exit(1)}" && \
    node -e "try{require('gifencoder'); console.log('✅ Gifencoder linked OK')}catch(e){console.error('❌ Gifencoder failed:', e); process.exit(1)}"

# Copy the rest of the source
COPY . .

# Self-healing prebuild with dependency auto-fix
RUN echo "🎯 [Docker] Running prebuild validation with auto-healing..." && \
    npm run prebuild || \
    (echo "🩹 [Docker] Prebuild failed, running auto-fix..." && \
     node scripts/prebuild-validate.cjs || \
     echo "🆘 [Docker] Auto-fix failed, retrying prebuild..." && \
     npm run prebuild)

# Self-healing build process with multiple retry strategies
RUN echo "🔨 [Docker] Starting TypeScript build..." && \
    npm run build || \
    (echo "🔧 [Docker] First build failed, ensuring dependencies..." && \
     npm run prebuild && \
     npm run build || \
     (echo "🆘 [Docker] Second attempt failed, final retry..." && \
      npm install --legacy-peer-deps && \
      npm run prebuild && \
      npm run build || \
      (echo "💥 [Docker] All build attempts failed" && exit 1)))

# Verify the build output exists
RUN echo "🔍 [Docker] Verifying build output..." && \
    test -f dist/src/index.js || \
    (echo "❌ [Docker] Build output not found!" && exit 1) && \
    echo "✅ [Docker] Build completed successfully!"

# Prune to production dependencies after build to keep runtime small
RUN echo "🧹 [Docker] Optimizing for production..." && \
    npm prune --omit=dev && \
    npm cache clean --force

# ---------- Runtime: small image with only prod deps & compiled JS ----------
FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production \
    npm_config_fund=false \
    npm_config_audit=false \
    DATABASE_URL=file:/data/guhdeats.db \
    PORT=3000

WORKDIR /app

# Install runtime libraries for canvas + OpenSSL for Prisma + Railway health checks
RUN apt-get update && apt-get install -y \
    openssl \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

# Create non-root user for security (Railway best practice)
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy only what we need at runtime with optimized layer structure
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy startup and health check scripts
COPY scripts/start.sh /start.sh
COPY scripts/health-check.js /health-check.js
RUN chmod +x /start.sh && chmod +x /health-check.js

# Set proper ownership for Railway
RUN chown -R appuser:appuser /app
USER appuser

# Expose port for Railway health checks
EXPOSE 3000

# Default command - optimized for Railway deployment
CMD ["/start.sh"]