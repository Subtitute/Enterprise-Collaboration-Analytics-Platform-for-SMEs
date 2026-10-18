# 15/10/2026: Dockerfile cho Inventory Service - sao chep tu apps/crm-service/Dockerfile
# (file mau tham chieu), chi doi ten service va cong.
#
# Build context BAT BUOC la thu muc goc cua repo (xem infra/docker-compose.yml: context: ..)
# vi can truy cap packages/common-dto, packages/common-guard va packages/common-metrics (npm workspaces).

FROM node:20-alpine AS builder
WORKDIR /workspace

COPY . .
RUN npm ci

RUN npm run build -w packages/common-dto
RUN npm run build -w packages/common-guard
RUN npm run build -w packages/common-metrics
RUN npm run build -w apps/inventory-service

# Prune devDependencies now that the TypeScript build is done - mirror apps/crm-service/Dockerfile.
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

# node:20-alpine ships a built-in non-root "node" user/group (uid/gid 1000) - run the
# service as that user instead of root.
COPY --from=builder --chown=node:node /workspace/node_modules ./node_modules
COPY --from=builder --chown=node:node /workspace/package.json ./package.json
COPY --from=builder --chown=node:node /workspace/packages/common-dto/dist ./packages/common-dto/dist
COPY --from=builder --chown=node:node /workspace/packages/common-dto/package.json ./packages/common-dto/package.json
COPY --from=builder --chown=node:node /workspace/packages/common-guard/dist ./packages/common-guard/dist
COPY --from=builder --chown=node:node /workspace/packages/common-guard/package.json ./packages/common-guard/package.json
COPY --from=builder --chown=node:node /workspace/packages/common-metrics/dist ./packages/common-metrics/dist
COPY --from=builder --chown=node:node /workspace/packages/common-metrics/package.json ./packages/common-metrics/package.json
COPY --from=builder --chown=node:node /workspace/apps/inventory-service/dist ./apps/inventory-service/dist
COPY --from=builder --chown=node:node /workspace/apps/inventory-service/package.json ./apps/inventory-service/package.json

USER node
EXPOSE 3010
CMD ["node", "apps/inventory-service/dist/main.js"]
