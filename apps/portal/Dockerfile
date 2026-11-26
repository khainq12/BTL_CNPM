# Image cổng khách hàng. Build từ thư mục gốc: docker build -f apps/portal/Dockerfile --build-arg VITE_API_URL=https://api.example -t woms-portal .
FROM node:24-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/staff-web/package.json apps/staff-web/
COPY apps/portal/package.json apps/portal/
COPY e2e/package.json e2e/
RUN npm ci -w @woms/portal -w @woms/domain --include-workspace-root=false --ignore-scripts
COPY packages/domain packages/domain
COPY apps/portal apps/portal
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}
RUN cd apps/portal && npx vite build

FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY deploy/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/portal/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
