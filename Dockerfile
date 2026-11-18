# syntax=docker/dockerfile:1
# Development image for Outpost (Next.js + Prisma). Not meant for production.

# Node 24 on Debian slim (Firebase SDK v13 needs Node >= 24.12). Alpine is avoided because Prisma needs openssl/glibc.
FROM node:24-slim

# Prisma's engines link against openssl; ca-certificates lets it reach Supabase over TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# All following commands run inside /app in the container.
WORKDIR /app

# Copy only what npm ci needs first, so Docker caches the install layer
# and only reinstalls when dependencies or the Prisma schema change.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Clean install from the lockfile. The "postinstall" script runs `prisma generate`,
# which writes the client to lib/generated/prisma.
# The cache mount keeps npm's download cache between builds, so a rebuild after a
# dependency change only downloads what's new (important on a slow connection).
# Unstable connection: fewer parallel downloads, longer timeouts, and the whole install retried
# up to 5 times (already-downloaded packages stay in the cache, so each retry is faster).
RUN --mount=type=cache,target=/root/.npm \
    for i in 1 2 3 4 5; do \
      npm ci --no-audit --no-fund --prefer-offline --maxsockets=4 \
        --fetch-retries=6 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=180000 --fetch-timeout=600000 \
      && exit 0; echo "npm ci attempt $i failed, retrying"; sleep 5; \
    done; exit 1

# Copy the rest of the source. In development the bind mount replaces this anyway,
# but it keeps the image usable on its own.
COPY . .

# Next.js dev server port.
EXPOSE 3000

# Default command (docker-compose overrides it with the same thing plus -H 0.0.0.0).
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
