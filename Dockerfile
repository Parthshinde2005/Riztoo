# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S riztoo -u 1001

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p server/uploads && \
    chown -R riztoo:nodejs /app

# Switch to non-root user
USER riztoo

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start application with cluster mode
CMD ["node", "server/cluster.js"]