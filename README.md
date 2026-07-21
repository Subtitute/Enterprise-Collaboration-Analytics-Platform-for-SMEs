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
| `iam-service` | chi noi bo (internal-net), khong map ra host | Dang ky to chuc, user, department, role/permission |
| `project-task-service` | chi noi bo (internal-net), khong map ra host | Du an, cong viec (Kanban) |
| `document-service` | chi noi bo (internal-net), khong map ra host | Quan ly tai lieu (MinIO) |
| `notification-service` | chi noi bo (internal-net), khong map ra host | Thong bao real-time (MongoDB) |
| `analytics-service` | chi noi bo (internal-net), khong map ra host | Kafka consumer + KPI/dashboard (TimescaleDB) |

**(Cap nhat 21/07/2026)** Day la finding nghiem trong nhat cua dot review ha tang: 5 service nghiep
vu tren truoc day map port thang ra host, cho phep goi truc tiep bo qua Gateway (bo qua luon JWT
verify + rate limiting), ket hop voi header noi bo co the gia mao thi day la mot loi bypass xac
thuc hoan chinh. Ca 5 service gio chi con truy cap duoc qua mang noi bo `internal-net` (tu Gateway
hoac tu service khac trong cung mang) - **khong con truy cap truc tiep tu may host duoc nua**, du
`docker compose ps` van hien thi container dang chay. Xem `infra/docker-compose.yml` va
`Doc/Technical_Spec.md` muc 6/8.

Cac container ha tang/CSDL van map port ra host **chi de phuc vu debug cuc bo** (khong dung cho moi
truong co the truy cap tu ben ngoai):

| Container | Cong host | Cong mac dinh cua image | Ghi chu |
|---|---|---|---|
| `postgres-iam` | 5433 | 5432 | |
| `postgres-pt` | 5434 | 5432 | |
| `postgres-doc` | 5435 | 5432 | |
| `timescaledb` | 5436 | 5432 | |
| `mongodb` | 27017 | 27017 | |
| `kafka` | 9092 | 9092 | |
| `redis` | **6380** | 6379 | **Da doi cong** - may host co the da chay Redis khac o 6379; giao tiep noi bo giua cac container van dung dung 6379 qua ten service `redis`, khong bi anh huong. |
| `minio` | **9010** (API), **9011** (console) | 9000 (API), 9001 (console) | **Da doi cong** - may host co the da chay MinIO khac o 9000/9001; giao tiep noi bo van dung 9000/9001 qua ten service `minio`. |

> Neu ket noi truc tiep tu cong cu ben ngoai (psql, MongoDB Compass, redis-cli, mc/AWS CLI...) vao
> Redis hoac MinIO tu may host, **nho dung cong da doi o tren** (6380 va 9010/9011) thay vi cong
> mac dinh - day la loi thuong gap neu chi doc `docker-compose.yml` luot qua ma bo qua comment.

Chi tiet kien truc, so do luong su kien, quy uoc API: xem `Doc/Technical_Spec.md`.

## Chay bang Docker (khuyen nghi)

```powershell
cd infra
Copy-Item .env.example .env    # chinh sua secret truoc khi dung that
docker compose --env-file .env up -d --build
```

**(Cap nhat 21/07/2026)** File `.env` co 2 bien moi bat buoc phai co gia tri (da co san trong
`.env.example`, chi can doi gia tri that khi trien khai ngoai moi truong dev):
- `INTERNAL_SHARED_SECRET` - bi mat dung chung giua Gateway va 5 service noi bo, dung de xac thuc
  request noi bo (chong gia mao header `x-org-id`/`x-user-id`/`x-roles` neu ai do co goi thang vao
  service bo qua Gateway). Phai giong het nhau o ca 6 service.
- `CORS_ORIGIN` - origin duy nhat duoc Gateway/IAM Service whitelist cho CORS (thay wildcard `*`).
  Mac dinh tro toi dev-server cua `apps/web` (`http://localhost:5173`).

Sau khi toan bo container o trang thai healthy (`docker compose ps`), truy cap
`http://localhost` de mo giao dien web. API Gateway (diem vao duy nhat) o cong 3000
(`http://localhost:3000/api/docs` cho Swagger tong hop). 5 service nghiep vu con lai
(`iam-service`, `project-task-service`, `document-service`, `notification-service`,
`analytics-service`) khong con map port ra host - Swagger rieng cua tung service chi xem duoc
tu ben trong `internal-net` (vi du `docker compose exec gateway wget -qO- http://iam-service:3001/api/docs-json`),
khong truy cap truc tiep tu trinh duyet tren may host duoc nua.

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
