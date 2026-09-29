# 28/09/2026: Dockerfile cho Messaging Service - sao chep tu apps/crm-service/Dockerfile (file mau
# tham chieu cho service dung TypeORM/Postgres), chi doi ten service va cong.
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
RUN npm run build -w apps/messaging-service

# Prune devDependencies now that the TypeScript build is done (tsc/@nestjs/cli/ts-jest/
# ESLint/etc. have already done their job) - the runner stage only needs production
# dependencies, not build tooling or other services' unrelated dependency trees. Safe
# to do AFTER the build steps above, since nothing past this point needs devDependencies.
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

# node:20-alpine ships a built-in non-root "node" user/group (uid/gid 1000) - run the
# service as that user instead of root. --chown on each COPY so the "node" user
# actually owns what it needs to read (Node doesn't need to WRITE anything at runtime
# here: no disk-based file uploads/session storage in this service).
COPY --from=builder --chown=node:node /workspace/node_modules ./node_modules
COPY --from=builder --chown=node:node /workspace/package.json ./package.json
COPY --from=builder --chown=node:node /workspace/packages/common-dto/dist ./packages/common-dto/dist
COPY --from=builder --chown=node:node /workspace/packages/common-dto/package.json ./packages/common-dto/package.json
COPY --from=builder --chown=node:node /workspace/packages/common-guard/dist ./packages/common-guard/dist
COPY --from=builder --chown=node:node /workspace/packages/common-guard/package.json ./packages/common-guard/package.json
COPY --from=builder --chown=node:node /workspace/packages/common-metrics/dist ./packages/common-metrics/dist
COPY --from=builder --chown=node:node /workspace/packages/common-metrics/package.json ./packages/common-metrics/package.json
COPY --from=builder --chown=node:node /workspace/apps/messaging-service/dist ./apps/messaging-service/dist
COPY --from=builder --chown=node:node /workspace/apps/messaging-service/package.json ./apps/messaging-service/package.json

USER node
EXPOSE 3009
CMD ["node", "apps/messaging-service/dist/main.js"]
