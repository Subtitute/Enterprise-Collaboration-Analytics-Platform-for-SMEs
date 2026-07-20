# 2026-07-18: Dockerfile cho API Gateway - sao chep tu apps/iam-service/Dockerfile
# (file mau tham chieu), chi doi ten service va cong.
#
# Build context BAT BUOC la thu muc goc cua repo (xem infra/docker-compose.yml: context: ..)
# vi can truy cap ca packages/common-dto va packages/common-guard (npm workspaces).

FROM node:20-alpine AS builder
WORKDIR /workspace

COPY . .
RUN npm ci

RUN npm run build -w packages/common-dto
RUN npm run build -w packages/common-guard
RUN npm run build -w apps/gateway

FROM node:20-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/packages/common-dto/dist ./packages/common-dto/dist
COPY --from=builder /workspace/packages/common-dto/package.json ./packages/common-dto/package.json
COPY --from=builder /workspace/packages/common-guard/dist ./packages/common-guard/dist
COPY --from=builder /workspace/packages/common-guard/package.json ./packages/common-guard/package.json
COPY --from=builder /workspace/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /workspace/apps/gateway/package.json ./apps/gateway/package.json

EXPOSE 3000
CMD ["node", "apps/gateway/dist/main.js"]
