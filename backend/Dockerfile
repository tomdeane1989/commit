# Sales Commission SaaS - Backend Dockerfile
# Multi-stage build for Node.js/Express + Prisma

# Stage 1: Dependencies
FROM node:22-alpine AS dependencies
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    libc6-compat

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Build stage (if needed for transpilation)
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./

# Copy source code
COPY . .

# Build step (currently not needed for Express, but ready for future)
# RUN npm run build

# Stage 3: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    openssl \
    libc6-compat

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nodeuser

# Copy built application
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./
COPY --chown=nodeuser:nodejs . .

# Create required directories
RUN mkdir -p logs && chown nodeuser:nodejs logs

# Expose port
EXPOSE 3002

# Switch to non-root user
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "server-working.js"]