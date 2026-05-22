# --- Stage 1: Builder ---
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (sqlite3, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    pkg-config \
    ca-certificates \
    libssl-dev \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install ALL dependencies (including devDeps for build)
COPY package*.json ./
# Use --ignore-scripts to prevent the 'prepare' script from failing before source code is copied
RUN npm ci --legacy-peer-deps --ignore-scripts

# Copy the rest of the source code (respecting .dockerignore)
COPY . .

# Generate types and compile TypeScript
RUN npm run generate:types
RUN npx tsc

# Prune dev dependencies to keep production image light
RUN npm prune --production


# --- Stage 2: Runner ---
FROM node:20-slim AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3006

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -r sentinel && useradd -r -g sentinel sentinel

# Pre-create logs and data directories with correct ownership
RUN mkdir -p /app/logs /app/data && chown -R sentinel:sentinel /app/logs /app/data

# Copy built assets and production node_modules from builder
COPY --from=builder --chown=sentinel:sentinel /app/dist ./dist
COPY --from=builder --chown=sentinel:sentinel /app/node_modules ./node_modules
COPY --from=builder --chown=sentinel:sentinel /app/dashboard ./dashboard
COPY --from=builder --chown=sentinel:sentinel /app/package.json ./package.json

# Copy agent-id.json if it exists (it might be missing on fresh clones)
COPY --from=builder --chown=sentinel:sentinel /app/agent-id.jso[n] ./agent-id.json

USER sentinel

# Expose the unified server port
EXPOSE 3006

# Healthcheck against the health API
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3006/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Default entrypoint starts the unified agent server
# Note: --import tsx is required for ESM module resolution in some 3rd-party dependencies (like genkitx-groq)
ENTRYPOINT ["node", "--import", "tsx", "dist/src/logic/agent_brain.js"]
CMD ["start"]
