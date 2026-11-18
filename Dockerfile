# ==============================================================================
# VYUMI "Shop With Me" - Multi-stage Production Dockerfile
# Serves the built React 19 frontend and Express 5 backend from a single port (3001)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend Single Page Application
# ------------------------------------------------------------------------------
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Backend Runtime
# ------------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app

# Install native dependencies required for better-sqlite3 compilation
RUN apk add --no-cache python3 make g++ gcc

# Install backend production dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev --ignore-scripts

# Copy backend application source code
WORKDIR /app
COPY backend/ ./backend/

# Copy compiled frontend assets into place for Express static serving
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
# The public result renderer shares the React presentation sources.
COPY --from=frontend-builder /app/frontend/src/theme.css /app/frontend/src/World.css ./frontend/src/

# Create persistent storage directories
RUN mkdir -p /app/backend/data /app/backend/uploads && chown -R node:node /app
USER node

# Configure environment defaults
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=data/shop-with-me.sqlite \
    FRONTEND_URL=http://localhost:3001 \
    LOG_LEVEL=info

EXPOSE 3001

# Health check using lightweight liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health/live', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "backend/src/server.js"]
