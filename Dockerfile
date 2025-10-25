FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Set a dummy DATABASE_URL for build-time Prisma generation
ENV DATABASE_URL="file:/data/guhdeats.db"

# Generate Prisma client
RUN npx prisma generate

# Create data directory
RUN mkdir -p /data

# Copy startup script
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

# Run migrations and start bot
CMD ["/start.sh"]

