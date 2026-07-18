# Build stage: pnpm workspace — build the SPA and compile the server.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile
COPY server server
COPY web web
RUN pnpm --filter inv-app-web build && pnpm --filter inv-app-server build

# Runtime stage: server prod deps only + built artifacts. The server serves
# the SPA from ../web/dist (see server/src/app.ts), so the layout mirrors the
# repo: /app/server + /app/web/dist.
FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --prod --filter inv-app-server
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/assets server/assets
COPY --from=build /app/web/dist web/dist

ENV NODE_ENV=production
# The file store lives here; mount a persistent volume at this path.
ENV DATA_DIR=/data
WORKDIR /app/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
