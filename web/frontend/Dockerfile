# ============================
# Stage 1: Build
# ============================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source and build
COPY astro.config.mjs tsconfig.json ./
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

# Prune devDependencies
RUN npm prune --omit=dev

# ============================
# Stage 2: Production Runtime
# ============================
FROM node:22-alpine AS runtime

RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

# Copy pruned node_modules and built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Non-root user
RUN addgroup -g 1001 -S luxipanel && \
    adduser -S luxipanel -u 1001 -G luxipanel

USER luxipanel

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4321/ || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server/entry.mjs"]
