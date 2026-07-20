# 2026-07-18: Dockerfile chuan cho IAM Service.
# ĐÂY LÀ FILE MẪU THAM CHIẾU cho toan bo cac NestJS service khac trong monorepo
# (gateway, project-task-service, document-service, notification-service, analytics-service):
# chi can doi ten "iam-service" thanh ten service tuong ung va giu nguyen cau truc build.
#
# Build context BAT BUOC la thu muc goc cua repo (xem infra/docker-compose.yml: context: ..)
# vi can truy cap ca packages/common-dto va packages/common-guard (npm workspaces).

FROM node:20-alpine AS builder
WORKDIR /workspace

COPY . .
RUN npm ci

# Build tung package rieng le. LUU Y quan trong: packages/common-dto va common-guard dung
# tsconfig incremental (tsconfig.base.json), sinh file *.tsbuildinfo canh package.json (KHONG
# nam trong dist/). File nay BAT BUOC phai nam trong .dockerignore - neu khong, mot
# tsbuildinfo cu tren host se bi COPY vao image, khien tsc tuong nham cac file da bien dich
# roi (dua vao cache) va bo qua emit chung, du dist/ that ra dang rong trong container.
RUN npm run build -w packages/common-dto
RUN npm run build -w packages/common-guard
RUN npm run build -w apps/iam-service

FROM node:20-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/packages/common-dto/dist ./packages/common-dto/dist
COPY --from=builder /workspace/packages/common-dto/package.json ./packages/common-dto/package.json
COPY --from=builder /workspace/packages/common-guard/dist ./packages/common-guard/dist
COPY --from=builder /workspace/packages/common-guard/package.json ./packages/common-guard/package.json
COPY --from=builder /workspace/apps/iam-service/dist ./apps/iam-service/dist
COPY --from=builder /workspace/apps/iam-service/package.json ./apps/iam-service/package.json

EXPOSE 3001
CMD ["node", "apps/iam-service/dist/main.js"]
