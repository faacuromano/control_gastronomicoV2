# =============================================================================
# Backend - Dockerfile para Desarrollo
# =============================================================================
# Versión simplificada sin multi-stage para desarrollo más rápido
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/
COPY scripts ./scripts/
COPY migration-scripts ./migration-scripts/

# Expose port
EXPOSE 3001

# Start command
CMD ["npm", "run", "dev"]
