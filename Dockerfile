# Multi-stage Dockerfile for vertex-sentinel

# Builder: installs build deps, installs node deps, compiles TypeScript
FROM node:20-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    pkg-config \
    libsqlite3-dev \
    libssl-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package metadata first to leverage cache
COPY package*.json ./
COPY packages/sentinel-sdk/package*.json packages/sentinel-sdk/

# Install dependencies for build
RUN npm ci --silent --ignore-scripts

# Copy source and build
COPY . .

# Install dependencies (with scripts) so packages with postinstall/build scripts are prepared
RUN npm ci --silent

# Generate types and build project
RUN npm run generate:types && npm run build


# Runner: minimal runtime image with only production deps and compiled output
FROM node:20-slim AS runner

# Install only runtime OS dependencies (ffmpeg for fluent-ffmpeg, ca-certificates)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r sentinel && useradd -r -g sentinel -d /app sentinel

# Copy compiled output and package metadata
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY package-lock.json ./

# Copy node_modules from builder (includes built deps)
COPY --from=builder /app/node_modules ./node_modules

# Add shim for genkitx-groq to ensure ESM resolution of groq_models without extension
RUN if [ -d "node_modules/genkitx-groq/lib" ]; then \
  printf "export * from './groq_models.mjs';\n" > node_modules/genkitx-groq/lib/groq_models.js; \
fi

# Copy dashboard static assets if present
COPY --from=builder /app/dashboard ./dashboard

# Create runtime directories and set permissions
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
RUN mkdir -p /app/logs /app/data && chown -R sentinel:sentinel /app

ENV NODE_ENV=production
ENV PORT=3006

USER sentinel

EXPOSE 3006

# Simple http healthcheck; adjust path if API root differs
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --quiet --tries=1 --spider http://localhost:3006/ || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
