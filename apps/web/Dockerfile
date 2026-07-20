# 2026-07-18: Dockerfile cho Web (React SPA).
# Build context BAT BUOC la thu muc goc cua repo (xem infra/docker-compose.yml: context: ..),
# giong het quy uoc cua cac NestJS service (xem apps/iam-service/Dockerfile) vi can npm ci
# tren toan bo npm workspaces tu root.
#
# Stage 1: build SPA tinh (static) bang Vite.
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY . .
RUN npm ci

# Cac bien VITE_* phai co mat luc build (Vite inline chung vao bundle qua import.meta.env),
# khac voi cac bien runtime cua NestJS service. infra/docker-compose.yml truyen chung qua build.args.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_WS_NOTIFICATION_URL=/ws/notifications
ARG VITE_WS_ANALYTICS_URL=/ws/analytics
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_NOTIFICATION_URL=$VITE_WS_NOTIFICATION_URL
ENV VITE_WS_ANALYTICS_URL=$VITE_WS_ANALYTICS_URL

RUN npm run build -w apps/web

# Stage 2: phuc vu dist/ tinh bang Nginx, dong thoi lam reverse-proxy cho /api/v1 va /ws
# sang Gateway (xem nginx.conf).
FROM nginx:alpine AS runner

COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
