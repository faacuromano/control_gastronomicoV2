# =============================================================================
# Frontend - Dockerfile para Desarrollo
# =============================================================================
# Versión simplificada para desarrollo rápido
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Run as non-root user
USER node

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server bound to localhost only
CMD ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
