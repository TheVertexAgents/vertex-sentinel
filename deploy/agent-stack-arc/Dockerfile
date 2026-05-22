# Standalone Dockerfile for agent-stack-arc
# Copy this to the root of the agent-stack-arc repository
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Expose port (default 3000)
EXPOSE 3000

# Start
ENTRYPOINT ["npm", "start"]
