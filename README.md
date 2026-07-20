# Enterprise Collaboration & Analytics Platform for SMEs

Nen tang Cong tac Doanh nghiep & Phan tich Du lieu cho Doanh nghiep Vua va Nho — do an tot nghiep,
Khoa Cong nghe Thong tin. Xem dac ta day du tai [`Doc/General_idea.md`](../Doc/General_idea.md),
[`Doc/Technical_Spec.md`](../Doc/Technical_Spec.md), [`Doc/Wireframe.md`](../Doc/Wireframe.md).

## Kien truc tong quan

Monorepo npm workspaces gom **Core Platform** (6 microservice NestJS + React SPA) va
**Analytics Pipeline** (Kafka + TimescaleDB), toan bo dong goi bang Docker Compose.

| Thanh phan | Cong (local) | Mo ta |
|---|---|---|
| `web` | 80 | React SPA (Nginx) |
| `gateway` | 3000 | API Gateway - diem vao duy nhat |
| `iam-service` | 3001 | Dang ky to chuc, user, department, role/permission |
| `project-task-service` | 3002 | Du an, cong viec (Kanban) |
| `document-service` | 3003 | Quan ly tai lieu (MinIO) |
| `notification-service` | 3004 | Thong bao real-time (MongoDB) |
| `analytics-service` | 3005 | Kafka consumer + KPI/dashboard (TimescaleDB) |

Chi tiet kien truc, so do luong su kien, quy uoc API: xem `Doc/Technical_Spec.md`.

## Chay bang Docker (khuyen nghi)

```powershell
cd infra
Copy-Item .env.example .env    # chinh sua secret truoc khi dung that
docker compose --env-file .env up -d --build
```

Sau khi toan bo container o trang thai healthy (`docker compose ps`), truy cap
`http://localhost` de mo giao dien web (Gateway noi bo o cong 3000, Swagger cua tung
service tai `http://localhost:<cong service>/api/docs`).

Seed du lieu demo (dang ky 1 to chuc mau, phong ban, nhan vien, du an, cong viec):

```powershell
cd ..
npm run seed
```

Dung toan bo he thong: `docker compose -f infra/docker-compose.yml down` (them `-v` neu muon
xoa luon volume du lieu).

## Chay cho phat trien cuc bo (khong Docker)

Yeu cau Node.js >= 20. Cai dependency mot lan duy nhat o thu muc goc (npm workspaces):

```powershell
npm install
npm run build:libs   # bat buoc build packages/common-dto va packages/common-guard truoc
```

Hạ tang (Postgres x3, TimescaleDB, MongoDB, Kafka, Redis, MinIO) van nen chay qua Docker Compose
(`docker compose -f infra/docker-compose.yml up -d postgres-iam postgres-pt postgres-doc timescaledb mongodb redis minio kafka minio-init`),
sau do chay tung service bang lenh workspace tuong ung, moi service 1 terminal:

```powershell
npm run dev:iam
npm run dev:gateway
npm run dev:project-task
npm run dev:document
npm run dev:notification
npm run dev:analytics
npm run dev:web
```

Moi service doc cau hinh tu file `.env` rieng trong thu muc `apps/<service>/` (xem
`apps/<service>/.env.example` de biet cac bien can thiet).

## Cau truc repo

```
apps/            6 NestJS service + web (React SPA)
packages/        Thu vien dung chung (common-dto, common-guard)
infra/           docker-compose.yml, script khoi tao Postgres/TimescaleDB
scripts/         Script seed du lieu demo
Doc/             Tai lieu dac ta (General_idea, Technical_Spec, Wireframe, ClaudeRule)
```

## Ghi chu

- MVP tap trung vao 6 service o bang tren; HRM-lite, CRM-lite, Kubernetes, Prometheus/Grafana,
  Debezium CDC la cac huong mo rong khong bat buoc (xem `Doc/General_idea.md` muc 3 va
  `Doc/Technical_Spec.md` muc 14).
- `synchronize: true` duoc dung cho TypeORM thay vi migration thu cong - phu hop pham vi 1 hoc ky
  (xem gioi han da biet trong `Doc/Technical_Spec.md`).
