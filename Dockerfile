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

# Set DATABASE_URL for Prisma build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

# Build the application (skip type checking to avoid Prisma build issues)
ENV NEXT_SKIP_TYPE_CHECK=true
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
# Bind on all interfaces so kubelet probes and ClusterIP work (not only pod hostname).
ENV HOSTNAME=0.0.0.0

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built assets from standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8787 || exit 1

# Start the Next.js standalone server
CMD ["node", "server.js"]
