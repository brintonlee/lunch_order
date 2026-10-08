# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/core/package.json packages/core/
COPY packages/ai/package.json packages/ai/
COPY packages/discord/package.json packages/discord/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# 只留 server 需要的 production 依賴
RUN pnpm --filter @lunch/server deploy --prod /out

# ---- runtime ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    MIGRATIONS_DIR=/app/drizzle \
    WEB_DIST_DIR=/app/web
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/web/dist ./web
COPY --from=build /app/packages/core/drizzle ./drizzle
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
