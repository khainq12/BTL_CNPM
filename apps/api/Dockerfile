# Image backend WOMS. Build từ thư mục gốc repo: docker build -f apps/api/Dockerfile -t woms-api .
# Nhiều tầng: tầng build có đủ công cụ, tầng chạy chỉ giữ thư viện cần thiết, chạy bằng tài khoản không phải root.
FROM node:24-bookworm-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/staff-web/package.json apps/staff-web/
COPY apps/portal/package.json apps/portal/
COPY e2e/package.json e2e/
RUN npm ci -w @woms/domain -w @woms/api --include-workspace-root=false
COPY packages/domain packages/domain
COPY apps/api apps/api
RUN npm run build -w @woms/domain && npm run build -w @woms/api \
  && npm prune --omit=dev -w @woms/api -w @woms/domain --include-workspace-root=false \
  && cd apps/api && npx prisma generate

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/domain/package.json ./packages/domain/package.json
COPY --from=build --chown=node:node /repo/packages/domain/dist ./packages/domain/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
ARG GIT_SHA=local
ENV GIT_SHA=${GIT_SHA}
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/v1/health/ready || exit 1
# Áp migration (an toàn khi chạy lại) rồi khởi động.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
