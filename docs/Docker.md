# Docker: Build & Run (local)

Build image locally:

  docker build -t vertex-sentinel:local .

Run (detached):

  docker run -d --rm -p 3006:3006 --name vs-local vertex-sentinel:local

Run interactively for debugging:

  docker run --rm -it --entrypoint /bin/sh vertex-sentinel:local
  # then inside container: node dist/src/logic/agent_brain.js

Notes:
- The container expects environment variables (see README) such as PORT and NODE_ENV.
- For development, use docker-compose.dev.yml which mounts the repository into the container.
- To speed up image size, later move build-only deps out of the runtime dependencies (some packages currently in devDependencies are required at runtime).
