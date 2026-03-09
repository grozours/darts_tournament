FROM node:20-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl postgresql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend

FROM base AS deps
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --omit=dev

FROM base AS build
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/ ./
COPY shared/ /app/shared/
RUN rm -rf dist && npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/dist/shared /app/shared
COPY --from=build /app/backend/dist/shared /app/backend/shared
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/scripts ./scripts
COPY --from=build /app/backend/package*.json ./
EXPOSE 3000
CMD ["sh", "-lc", "if [ -d /app/shared/src ] && [ ! -e /app/backend/shared/src ]; then mkdir -p /app/backend/shared && ln -s /app/shared/src /app/backend/shared/src; fi; if [ -d /app/backend/shared/src ] && [ ! -e /app/shared/src ]; then mkdir -p /app/shared && ln -s /app/backend/shared/src /app/shared/src; fi; npm start"]
