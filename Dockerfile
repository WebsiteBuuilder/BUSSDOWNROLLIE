FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create data directory
RUN mkdir -p /data

# Run migrations and start bot
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]

