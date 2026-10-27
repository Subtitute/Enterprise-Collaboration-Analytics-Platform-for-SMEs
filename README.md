# Enterprise Collaboration & Analytics Platform for SMEs

Nền tảng Cộng tác Doanh nghiệp & Phân tích Dữ liệu cho Doanh nghiệp Vừa và Nhỏ — đồ án tốt nghiệp,
Khoa Công nghệ Thông tin. Xem đặc tả đầy đủ tại [`Doc/General_idea.md`](../Doc/General_idea.md),
[`Doc/Technical_Spec.md`](../Doc/Technical_Spec.md), [`Doc/Wireframe.md`](../Doc/Wireframe.md).

## Kiến trúc tổng quan

Monorepo npm workspaces gồm **Core Platform** (8 microservice NestJS + React SPA) và
**Analytics Pipeline** (Kafka + TimescaleDB), toàn bộ đóng gói bằng Docker Compose.

| Thành phần | Cổng (local) | Mô tả |
|---|---|---|
| `web` | 80 | React SPA (Nginx) |
| `gateway` | 3000 | API Gateway - điểm vào duy nhất |
| `iam-service` | chỉ nội bộ (internal-net), không map ra host | Đăng ký tổ chức, user, department, role/permission |
| `project-task-service` | chỉ nội bộ (internal-net), không map ra host | Dự án, công việc (Kanban) |
| `document-service` | chỉ nội bộ (internal-net), không map ra host | Quản lý tài liệu (MinIO) |
| `notification-service` | chỉ nội bộ (internal-net), không map ra host | Thông báo real-time (MongoDB) |
| `analytics-service` | chỉ nội bộ (internal-net), không map ra host | Kafka consumer + KPI/dashboard (TimescaleDB) |
| `crm-service` | chỉ nội bộ (internal-net), không map ra host | Khách hàng, cơ hội bán hàng (bổ sung 04/08/2026) |
| `hrm-service` | chỉ nội bộ (internal-net), không map ra host | Chấm công (photo-proof), nghỉ phép (bổ sung 05/08/2026) |

**(Cập nhật 21/07/2026)** Đây là finding nghiêm trọng nhất của đợt review hạ tầng: 5 service nghiệp
vụ trên trước đây map port thẳng ra host, cho phép gọi trực tiếp bỏ qua Gateway (bỏ qua luôn JWT
verify + rate limiting), kết hợp với header nội bộ có thể giả mạo thì đây là một lỗi bypass xác
thực hoàn chỉnh. Cả 5 service giờ **không còn map port ra host nữa** - không có cách nào gọi thẳng
từ máy host bỏ qua Gateway, dù `docker compose ps` vẫn hiển thị container đang chạy. Xem
`infra/docker-compose.yml` và `Doc/Technical_Spec.md` mục 6/8.

**(Làm rõ 22/08/2026, phát hiện qua audit hạ tầng)** Cơ chế phía trên là "không công bố port ra
host", **không phải cô lập theo mạng** - `internal-net` (`infra/docker-compose.yml`) là MỘT mạng
bridge phẳng duy nhất chứa TẤT CẢ container (kể cả 5 Postgres, MongoDB, Redis, Kafka, MinIO,
Prometheus/Grafana), không có mạng "nội bộ" tách biệt mạng "công khai" nào cả. Nghĩa là bất kỳ
container nào đã có mặt trên `internal-net` (không chỉ Gateway) đều gọi thẳng được 5 service này -
"internal-net" chỉ nói đúng "không lộ ra ngoài máy host", không nói đúng "chỉ Gateway gọi được".
`Doc/Technical_Spec.md` mục 8/12 đã tự ghi nhận đây là rủi ro chấp nhận được cho phạm vi 1 máy học
viên tự quản, không phù hợp nếu triển khai lên môi trường nhiều máy/nhiều người dùng chung mạng.

Các container hạ tầng/CSDL vẫn map port ra host **chỉ để phục vụ debug cục bộ** (không dùng cho môi
trường có thể truy cập từ bên ngoài):

| Container | Cổng host | Cổng mặc định của image | Ghi chú |
|---|---|---|---|
| `postgres-iam` | 5433 | 5432 | |
| `postgres-pt` | 5434 | 5432 | |
| `postgres-doc` | 5435 | 5432 | |
| `timescaledb` | 5436 | 5432 | |
| `postgres-crm` | 5438 | 5432 | Bổ sung 04/08/2026 (CRM-lite) |
| `postgres-hrm` | 5439 | 5432 | Bổ sung 05/08/2026 (HRM-lite) |
| `mongodb` | 27017 | 27017 | |
| `kafka` | 9092 | 9092 | |
| `redis` | **6380** | 6379 | **Đã đổi cổng** - máy host có thể đã chạy Redis khác ở 6379; giao tiếp nội bộ giữa các container vẫn dùng đúng 6379 qua tên service `redis`, không bị ảnh hưởng. |
| `minio` | **9010** (API), **9011** (console) | 9000 (API), 9001 (console) | **Đã đổi cổng** - máy host có thể đã chạy MinIO khác ở 9000/9001; giao tiếp nội bộ vẫn dùng 9000/9001 qua tên service `minio`. |

> Nếu kết nối trực tiếp từ công cụ bên ngoài (psql, MongoDB Compass, redis-cli, mc/AWS CLI...) vào
> Redis hoặc MinIO từ máy host, **nhớ dùng cổng đã đổi ở trên** (6380 và 9010/9011) thay vì cổng
> mặc định - đây là lỗi thường gặp nếu chỉ đọc `docker-compose.yml` lướt qua mà bỏ qua comment.

Chi tiết kiến trúc, sơ đồ luồng sự kiện, quy ước API: xem `Doc/Technical_Spec.md`.

## Chạy bằng Docker (khuyến nghị)

```powershell
cd infra
Copy-Item .env.example .env    # chỉnh sửa secret trước khi dùng thật
docker compose --env-file .env up -d --build
```

**(Cập nhật 21/07/2026)** File `.env` có 2 biến mới bắt buộc phải có giá trị (đã có sẵn trong
`.env.example`, chỉ cần đổi giá trị thật khi triển khai ngoài môi trường dev):
- `INTERNAL_SHARED_SECRET` - bí mật dùng chung giữa Gateway và 7 service nội bộ, dùng để xác thực
  request nội bộ (chống giả mạo header `x-org-id`/`x-user-id`/`x-roles` nếu ai đó cố gọi thẳng vào
  service bỏ qua Gateway). Phải giống hệt nhau ở cả 8 service.
- `CORS_ORIGIN` - origin duy nhất được Gateway/IAM Service whitelist cho CORS (thay wildcard `*`).
  Mặc định trỏ tới dev-server của `apps/web` (`http://localhost:5173`).

Sau khi toàn bộ container ở trạng thái healthy (`docker compose ps`), truy cập
`http://localhost` để mở giao diện web. API Gateway (điểm vào duy nhất) ở cổng 3000
(`http://localhost:3000/api/v1/health` để kiểm tra nhanh). Gateway **không** có trang Swagger
tổng hợp - mọi đường dẫn không khớp route proxy nào (kể cả `/api/docs`) bị middleware xác thực
JWT của Gateway từ chối với `401` trước khi tới được bất kỳ service nào. 7 service nghiệp vụ
(`iam-service`, `project-task-service`, `document-service`, `notification-service`,
`analytics-service`, `crm-service`, `hrm-service`) không map port ra host - Swagger riêng của
từng service chỉ xem được từ bên trong `internal-net` (ví dụ `docker compose exec gateway wget -qO- http://iam-service:3001/api/docs-json`),
không truy cập trực tiếp từ trình duyệt trên máy host được nữa.

Seed dữ liệu demo (đăng ký 1 tổ chức mẫu, phòng ban, nhân viên, dự án, công việc):

```powershell
cd ..
npm run seed
```

Dừng toàn bộ hệ thống: `docker compose -f infra/docker-compose.yml down` (thêm `-v` nếu muốn
xoá luôn volume dữ liệu).

## Chạy cho phát triển cục bộ (không Docker)

Yêu cầu Node.js >= 20. Cài dependency một lần duy nhất ở thư mục gốc (npm workspaces):

```powershell
npm install
npm run build:libs   # bắt buộc build packages/common-dto, common-guard, common-metrics trước
```

Hạ tầng (Postgres x5, TimescaleDB, MongoDB, Kafka, Redis, MinIO) vẫn nên chạy qua Docker Compose
(`docker compose -f infra/docker-compose.yml up -d postgres-iam postgres-pt postgres-doc postgres-crm postgres-hrm timescaledb mongodb redis minio kafka minio-init`),
sau đó chạy từng service bằng lệnh workspace tương ứng, mỗi service 1 terminal:

```powershell
npm run dev:iam
npm run dev:gateway
npm run dev:project-task
npm run dev:document
npm run dev:notification
npm run dev:analytics
npm run dev:crm
npm run dev:hrm
npm run dev:web
```

Mỗi service đọc cấu hình từ file `.env` riêng trong thư mục `apps/<service>/` (xem
`apps/<service>/.env.example` để biết các biến cần thiết).

## Cấu trúc repo

```
apps/            8 NestJS service + web (React SPA)
packages/        Thư viện dùng chung (common-dto, common-guard, common-metrics)
infra/           docker-compose.yml, script khởi tạo Postgres/TimescaleDB, cấu hình Prometheus/Grafana
scripts/         Script seed dữ liệu demo
Doc/             Tài liệu đặc tả (General_idea, Technical_Spec, Wireframe, ClaudeRule)
```

## Observability (Prometheus + Grafana)

Sau khi toàn bộ container healthy, giám sát hạ tầng/vận hành (latency, tỷ lệ lỗi HTTP, tài nguyên,
Kafka consumer lag) có sẵn tại:

- Grafana: `http://localhost:3010` (tài khoản `admin` / giá trị `GRAFANA_ADMIN_PASSWORD` trong
  `.env`, mặc định dev là `admin`) - dashboard "ECAP - Tổng quan hạ tầng" được tự động cấu hình sẵn.
- Prometheus: `http://localhost:9090` (chỉ phục vụ debug cục bộ, cùng quy ước với các cổng debug
  hạ tầng khác ở bảng trên).
- **(Bổ sung 22/08/2026)** Alertmanager: `http://localhost:9095` (cảnh báo chủ động - 4 luật ở
  `infra/prometheus/alert-rules.yml`, định tuyến ở `infra/alertmanager/alertmanager.yml`; **chưa
  có kênh thông báo thật** (Slack/email) vì đây là môi trường 1 máy học viên tự quản - alert vẫn
  được đánh giá/chuyển trạng thái "firing" thật sự, chỉ chưa có ai được báo ngoài giao diện này).

Tách biệt hoàn toàn khỏi Analytics Dashboard nghiệp vụ (KPI công việc/dự án/tài liệu, xem trong
web app) - xem `Doc/Technical_Spec.md` mục 15.

## Sao lưu / phục hồi dữ liệu

**(Bổ sung 22/08/2026, cập nhật 26/10/2026)** Sao lưu thủ công (chưa có lịch cron tự động) cho toàn bộ
11 nguồn dữ liệu (8 Postgres + TimescaleDB + MongoDB + MinIO — mọi bucket đang có, kể cả bucket thêm về sau):

```powershell
npm run backup                                    # tạo backups/<timestamp>/ (đã .gitignore)
npm run restore -- <ten-thu-muc-trong-backups>    # ghi đè dữ liệu hiện tại bằng bản sao lưu đó
```

Yêu cầu stack đang chạy (`docker compose up -d`). Xem `scripts/backup.js`/`scripts/restore.js` để
biết chi tiết.

## Ghi chú

- **(Bổ sung 20-21/08/2026)** Giao diện web hỗ trợ Việt (mặc định)/English/日本語 — đổi qua nút
  chọn ngôn ngữ (🌐) ở màn đăng nhập hoặc Topbar sau khi đăng nhập. Chi tiết kỹ thuật:
  `Doc/Technical_Spec.md` mục 18.
- MVP bắt buộc gồm 6 service đầu tiên ở bảng trên; `crm-service`/`hrm-service` là 2 hạng mục mở
  rộng đã triển khai thêm (04-05/08/2026). Kubernetes, dự báo xu hướng ML/thống kê vẫn là hướng
  mở rộng chưa triển khai (xem `Doc/General_idea.md` mục 3 và `Doc/Technical_Spec.md` mục 14);
  Debezium CDC đã có bản thử nghiệm tùy chọn (mục CDC bên dưới, 25/10/2026).
- `synchronize: true` được dùng cho TypeORM thay vì migration thủ công - phù hợp phạm vi 1 học kỳ
  (xem giới hạn đã biết trong `Doc/Technical_Spec.md`).

## CDC Debezium (thử nghiệm, tùy chọn - profile `cdc`)

*(Bổ sung 25/10/2026)* Bản thử nghiệm thay Outbox polling (chu kỳ 2.5s) của `project-task-service`
bằng Debezium đọc WAL của bảng `outbox_events` (Outbox Event Router → topic `project-task.events`,
cùng key `organizationId` và cùng envelope `DomainEvent`, nên consumer không phải sửa). Container
`debezium` nằm trong profile **tắt mặc định** `cdc` - `docker compose up -d` thường không bật nó; chỉ
dùng cho demo ngắn (Kafka Connect giới hạn heap 384MB, `mem_limit` 768MB).

Bật/tắt **chỉ** bằng 2 script (PowerShell, chạy từ thư mục gốc repo, stack đang chạy):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cdc-on.ps1    # bật CDC, tắt polling
powershell -ExecutionPolicy Bypass -File .\scripts\cdc-off.ps1   # tắt CDC, bật lại polling
```

- `cdc-on.ps1`: bật `debezium` (tạo lại `postgres-pt` nếu chưa có `wal_level=logical`), đăng ký
  connector `pt-outbox-connector` (`snapshot.mode=no_data`: không gửi lại dòng outbox cũ), chờ
  replication slot `pt_outbox_slot` hoạt động và polling gửi hết phần tồn, rồi mới tạo lại
  `project-task-service` với `ENABLE_OUTBOX_POLLING=false`.
- `cdc-off.ps1`: chờ Debezium xác nhận đã đẩy tới Kafka mọi thay đổi trước một mốc thời gian, đánh dấu
  `published=true` cho các dòng outbox đó (để polling không gửi lại hàng loạt), bật lại polling, xóa
  connector, dừng `debezium`, xóa replication slot và publication.
- Thứ tự bước trong 2 script đảm bảo không mất sự kiện; có thể trùng lặp vài sự kiện lúc chuyển chế
  độ - vô hại vì `analytics-service`/`notification-service` idempotent theo `eventId`. Chạy lại script
  nhiều lần đều an toàn.
- Không tắt CDC bằng cách chỉ `docker stop debezium` hay sửa `ENABLE_OUTBOX_POLLING` bằng tay: slot
  còn lại khiến Postgres giữ WAL cho nó, còn các dòng outbox CDC đã gửi sẽ bị polling gửi lại.
  `max_slot_wal_keep_size=512MB` chỉ giới hạn lượng WAL giữ lại **cho slot**, không phải tổng dung
  lượng `pg_wal`; vượt ngưỡng thì slot chuyển `lost` và không dùng lại được - `cdc-on.ps1` sẽ báo
  ngay, khi đó chạy `cdc-off.ps1` rồi `cdc-on.ps1`. *(Sửa 25/10/2026)*
- Dừng cả stack: chạy `cdc-off.ps1` trước rồi `docker compose --profile cdc down`. Lệnh
  `docker compose down` thường **bỏ sót** container `debezium` (profile `cdc` không bật) nên nó vẫn
  chạy. *(Bổ sung 25/10/2026)*
- Nếu `docker ps` báo `debezium` **unhealthy** (healthcheck kiểm tra connector và task đều
  `RUNNING`) trong lúc CDC bật thì sự kiện đang dừng (polling đã tắt) - chạy ngay
  `powershell -ExecutionPolicy Bypass -File .\scripts\cdc-off.ps1` để quay về polling, các dòng
  outbox chưa gửi sẽ được polling gửi tiếp, không mất. *(Bổ sung 25/10/2026)*
- Mỗi lần bật/tắt, script tạo lại container `project-task-service` nên API công việc/dự án gián đoạn
  khoảng 3-20 giây (502 hoặc request treo) - chuyển chế độ **trước** khi bắt đầu demo, không chuyển
  giữa chừng. *(Bổ sung 25/10/2026)*
- Trên Docker Desktop/WSL, tiến trình `wslrelay.exe` giữ `127.0.0.1` ở các cổng 3000, 80 và 9010 nên
  sau khi container được tạo lại, `localhost` có thể treo khoảng 90 giây trong khi IP LAN của máy trả
  lời ngay - đây là thêm một lý do để chuyển chế độ trước khi demo. *(Bổ sung 25/10/2026)*
- Mật khẩu DB không nằm trong `infra/debezium/register-pt-connector.json`: connector tham chiếu
  `${env:PT_DB_PASSWORD}` (EnvVarConfigProvider của Kafka Connect), giá trị lấy từ `infra/.env`.
  Provider chỉ cho phép đọc các biến `PT_DB_*` (allowlist, bổ sung 25/10/2026).

Kiểm chứng: đổi trạng thái một công việc trên Kanban rồi xem `docker logs --tail 30 debezium` và
`docker logs --tail 30 analytics-service`; log `project-task-service` lúc khởi động có cảnh báo
"Outbox polling dang TAT" khi CDC bật.
