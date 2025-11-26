# Build stage
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Production stage
FROM node:24-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nextjs -u 1001

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including production ones needed for runtime)
RUN npm ci && \
  npm cache clean --force && \
  rm -rf /tmp/* /var/cache/apk/*

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/app ./app

# Switch to non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application using the custom server
CMD ["npm", "start"]
