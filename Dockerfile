# Multi-stage Dockerfile for vertex-sentinel

# --- Stage 1: Builder ---
# Installs all deps, applies patches, and compiles TypeScript
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ build-essential pkg-config libsqlite3-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package metadata
COPY package*.json ./
COPY patches/ ./patches/

# Install all dependencies (including devDeps for build/patching)
# This will trigger 'postinstall: patch-package'
RUN npm ci --silent

# Verify genkitx-groq patch
RUN grep -q "groq_models.mjs" node_modules/genkitx-groq/lib/index.mjs && echo "Patch verified"

# Copy source and build
COPY . .
RUN npm run generate:types && npm run build


# --- Stage 2: Production Dependencies ---
# Inherits patched node_modules from builder and prunes them
FROM node:20-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ build-essential pkg-config libsqlite3-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package metadata and node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Prune devDependencies (this keeps the already applied patches)
RUN npm prune --production --silent

# Rebuild sqlite3 from source to ensure glibc compatibility
RUN npm rebuild sqlite3 --build-from-source --silent


# --- Stage 3: Runner ---
# Minimal runtime image
FROM node:20-slim AS runner

# Install runtime-only OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r sentinel && useradd -r -g sentinel -d /app sentinel

# Copy production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dashboard ./dashboard
COPY --from=builder /app/agent-id.json ./
COPY --from=builder /app/pitch-deck.html ./
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY docker-entrypoint.sh ./

# Create runtime directories and set permissions
RUN chmod +x docker-entrypoint.sh \
    && mkdir -p logs data \
    && chown -R sentinel:sentinel /app

ENV NODE_ENV=production
ENV PORT=3006
ENV HEALTH_SERVER=false

USER sentinel

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3006/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
