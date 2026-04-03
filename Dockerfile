# mkbrr binary stage
FROM ghcr.io/autobrr/mkbrr:latest AS mkbrr

# Build stage (using Bun)
FROM oven/bun:1.3.11 AS builder

WORKDIR /app

# Copy workspace manifests first for better cache use.
COPY bun.lock ./
COPY package.json ./
COPY tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/shared/package.json ./apps/shared/
COPY apps/web/package.json ./apps/web/

# Install workspace dependencies from repo root.
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source for all apps needed at build time
COPY apps/shared/ ./apps/shared/
COPY apps/web/ ./apps/web/

# Build the React frontend
RUN cd apps/web && bun run build

# Final production stage (using a slim Bun image)
FROM oven/bun:1.3.11-slim

WORKDIR /app

# Set locale for UTF-8 support
ENV LANG=C.UTF-8

# Prisma runtime requires OpenSSL, APNs needs curl
# C411 release pipeline needs mediainfo, mktorrent, mkbrr, ffmpeg (ffprobe)
RUN apt-get update -y && apt-get install -y openssl curl mediainfo mktorrent ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=mkbrr /usr/local/bin/mkbrr /usr/local/bin/mkbrr

# Copy only what's needed for the runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Copy API and shared source code
COPY apps/api ./apps/api
COPY apps/shared ./apps/shared

# Set working directory to the api application
WORKDIR /app/apps/api

# Copy built frontend assets into the API's public directory
COPY --from=builder /app/apps/web/dist ./public

# Expose the application port
EXPOSE 3000

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Run migrations then start the application
CMD ["./entrypoint.sh"]
