# Stage 1: Dependencies (production only for runner)
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Stage 2: Build (needs devDependencies for Tailwind, PostCSS, etc.)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY frontend/ ./

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV WS_PORT=8788
ENV HEALTH_PORT=9090

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy server source and tsconfig for tsx runtime
COPY --from=builder /app/server.production.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./

# Install tsx for running TypeScript directly
RUN npm install -g tsx

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose ports
EXPOSE 8787
EXPOSE 8788
EXPOSE 9090

# Health check using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9090/health || exit 1

# Start the application using tsx to handle path aliases
CMD ["tsx", "server.ts"]
