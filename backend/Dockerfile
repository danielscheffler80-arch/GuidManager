# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Install dependencies needed for prisma and build
RUN apt-get update && apt-get install -y openssl

# In a monorepo, we copy relative to the build context (root)
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm install

COPY backend/ .

# Generate Prisma Client and build the app
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /app

# Install openssl for prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/updates ./updates

EXPOSE 3334

# Use a shell script or direct command that runs migrations before starting
CMD npx prisma migrate deploy && node dist/index.js
