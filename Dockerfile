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
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    python3 \
    make \
    g++ \
    build-essential \
    pkg-config \
    libsqlite3-dev \
    libssl-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r sentinel && useradd -r -g sentinel -d /app sentinel

# Copy compiled output and package metadata
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY package-lock.json ./

# Install production node modules in runner
RUN npm ci --production --silent --no-audit || true
# Rebuild sqlite3 in the runner to ensure native binary links against runner glibc
RUN if [ -d "node_modules/sqlite3" ]; then \
  npm rebuild sqlite3 --build-from-source --silent || true; \
fi

# Patch genkitx-groq ESM import to reference .mjs explicitly (fix resolution)
RUN if [ -d "node_modules/genkitx-groq/lib" ]; then \
  perl -0777 -pe "s/from \"\.\/groq_models\"/from \"\.\/groq_models.mjs\"/g" -i node_modules/genkitx-groq/lib/index.mjs || true; \
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
