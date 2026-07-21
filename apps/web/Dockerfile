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

# Harden: stock nginx:alpine only drops its WORKER processes to the built-in non-root
# "nginx" user (uid/gid 101) - the master process (PID 1) still starts as root (checked
# directly against this image: `docker run nginx:alpine id` -> uid=0(root)). Make PID 1
# itself non-root too:
#   - setcap cap_net_bind_service on the nginx binary so it can still bind port 80 as a
#     non-root user (libcap removed again afterwards - the capability is stored as a
#     filesystem xattr on the binary, it doesn't need libcap installed at runtime).
#     This lets us keep `listen 80` in nginx.conf and port 80 in
#     infra/docker-compose.yml unchanged, instead of switching to the
#     nginx-unprivileged image's default port 8080 (which would silently break that
#     compose file's existing "80:80" port mapping/healthcheck).
#   - chown the cache dir (nginx creates client_body_temp/proxy_temp/etc. under here on
#     first use) and pre-create+chown the pid file nginx.conf points `pid` at.
RUN apk add --no-cache libcap \
    && setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx \
    && apk del libcap \
    && chown -R nginx:nginx /var/cache/nginx \
    && touch /run/nginx.pid \
    && chown nginx:nginx /run/nginx.pid \
    && sed -i '/^user /d' /etc/nginx/nginx.conf

COPY --from=builder --chown=nginx:nginx /workspace/apps/web/dist /usr/share/nginx/html
COPY --chown=nginx:nginx apps/web/nginx.conf /etc/nginx/conf.d/default.conf

USER nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
