# =============================================================================
# PentiumPOS Backend - Docker Image
# =============================================================================
# For development with docker-compose
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema for migrations
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source (will be mounted as volume in dev)
COPY src ./src/
COPY tsconfig.json ./

# Expose port
EXPOSE 3001

# Default command (overridden in docker-compose)
CMD ["npm", "run", "dev"]
