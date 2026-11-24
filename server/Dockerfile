# ==============================================================================
# Multi-stage Dockerfile for DTST Server (Node.js Express Backend API)
# ==============================================================================

# --- Stage 1: Build TypeScript ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (works both standalone without lockfile and with lockfile)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

# Copy sources and compile TypeScript
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production dependencies only
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev --no-audit --no-fund; fi && npm cache clean --force

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Ensure uploads directory exists and is writable by non-root node user
RUN mkdir -p /app/uploads/footprints && chown -R node:node /app/uploads

# Use standard non-root user provided by node image
USER node

EXPOSE 4000

# Healthcheck against backend health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
