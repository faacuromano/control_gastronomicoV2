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

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server (--host para acceder desde fuera del contenedor)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
