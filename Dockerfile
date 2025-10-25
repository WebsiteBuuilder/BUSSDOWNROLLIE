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
    npm_config_audit=false

WORKDIR /app

# Copy only what we need at runtime
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# If better-sqlite3 needs to rebind on this layer, allow rebuild fallback
# (usually not needed because builder compiled it already for the same base)
RUN node -e "try{require('better-sqlite3');console.log('better-sqlite3 OK')}catch(e){process.exit(1)}" || npm rebuild better-sqlite3

# Copy startup script
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

# Default command - fixed for Railway compatibility
CMD ["/start.sh"]
