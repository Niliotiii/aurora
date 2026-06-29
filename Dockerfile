# Aurora app (API) — Node.js 24.11.1
FROM node:24.11.1-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

# Copy application source, data scripts, schema and the WHO source CSVs
COPY src ./src
COPY data ./data
COPY tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 4000

# Seed the database (depends_on waits for Postgres health), then start serving.
# Node 24 runs TypeScript directly (native type stripping).
CMD ["sh", "-c", "node data/seed.ts && node src/index.ts"]
