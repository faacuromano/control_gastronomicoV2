# =============================================================================
# PentiumPOS Frontend - Docker Image
# =============================================================================
# For development with docker-compose
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source (will be mounted as volume in dev)
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Vite needs --host to be accessible from outside container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
