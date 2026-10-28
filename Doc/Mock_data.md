# Dữ liệu kiểm thử (Mock data) — ECAP

> Trạng thái: **ĐÃ TRIỂN KHAI** — bộ tài khoản, file mẫu và kịch bản kiểm thử sống (live) dưới đây đã
> được dùng cho đợt nghiệm thu toàn hệ thống ngày 24/10/2026 (sau khi hoàn thành Chatbot RAG và đợt giảm
> RAM). Mã nguồn kịch bản và file mẫu nằm ở `scripts/mock-data/`. Chi tiết lịch sử đầy đủ: xem
> `RevisionHistory.md`. Cập nhật 26/10/2026: chính sách tài liệu theo dự án và phạm vi dữ liệu của Manager
> (`Technical_Spec.md` §28) — kịch bản 04/08 đã sửa theo, kết quả chạy lại ở mục 9. Cập nhật 26/10/2026
> (tiếp): kịch bản mới `10-employee-directory.js` cho Danh sách nhân viên & kho ảnh nhận diện
> (`Technical_Spec.md` §27), xem mục 4.9 và mục 10. Cập nhật 28/10/2026: kho tài liệu demo đã dọn (seed không
> còn tệp `.txt/.csv` mẫu, 2 tài liệu công ty là PDF/DOCX thật — `Technical_Spec.md` §29), kết quả chạy lại ở
> mục 11.

**Mục đích:** gom về một chỗ (1) các tài khoản dùng để kiểm thử theo từng vai trò, (2) các bộ dữ liệu
và kịch bản tái sử dụng được cùng kết quả mong đợi, (3) cách dựng lại toàn bộ khi cần — để lần kiểm
thử sau không phải tự tạo dữ liệu thủ công.

**Nguyên tắc:** kịch bản **không sửa, không xoá dữ liệu demo có sẵn**. Mọi thứ kịch bản tạo ra đều mang
nhãn duy nhất `MOCK-<mã thời gian>` và bị xoá ở cuối lần chạy (kể cả khi lỗi giữa chừng — phần dọn dẹp
nằm trong khối `finally`).

---

## 1. Tài khoản kiểm thử theo vai trò

Tổ chức demo: **Demo SME** (25 thành viên: 2 Org Admin, 3 Manager, 20 Employee; 4 phòng ban Kinh doanh,
Kỹ thuật, Marketing, Nhân sự). Mật khẩu mặc định của mọi tài khoản demo là `Password123!`.

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Org Admin | `admin@demo-sme.vn` | `Password123!` | Toàn quyền tổ chức (52 quyền), không thuộc phòng ban |
| Manager | `an.nguyen+227860@demo-sme.vn` | `Password123!` | Nguyễn Văn An, phòng Kinh doanh (46 quyền) |
| Employee | `duc.hoang+227860@demo-sme.vn` | `Password123!` | Hoàng Văn Đức, phòng Kinh doanh (23 quyền) |
| Super Admin (nền tảng) | `superadmin@ecap-platform.local` | `SuperAdmin123!` | Không thuộc tổ chức nào, không có quyền nghiệp vụ |
| Org Admin tổ chức E2E | `admin@e2e-test.local` | `Password123!` | Tổ chức riêng cho bộ Playwright `e2e/`, **không dùng để demo** |

Lưu ý: tổ chức demo có 2 lô người dùng (hậu tố `+216140` và `+227860`) do seed chạy 2 lần; cùng họ tên
nhưng **khác vai trò** (vd `an.nguyen+216140` là Employee). Kịch bản luôn dùng lô `+227860`.

Hộp thư MailHog (email quên mật khẩu, lời mời thành viên): `http://127.0.0.1:8025`.

## 2. Dữ liệu nền và cách dựng lại

| Lệnh (chạy ở thư mục gốc repo) | Tạo ra |
|---|---|
| `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d` | Toàn bộ stack (điều kiện tiên quyết cho mọi mục dưới) |
| `npm run seed` | Tổ chức demo, người dùng, phòng ban, dự án/công việc và thư mục "`<dự án>` - Tai lieu", khách hàng (`scripts/seed.js`); ở cuối gọi 3 script idempotent dưới đây (26/10/2026). Từ 27/10/2026 không còn tải 15 tệp mẫu `bao-cao-tien-do-N.txt`/`du-lieu-cong-viec-N.csv` |
| `node scripts/migrate-project-documents.js` | Gắn thư mục "`<dự án>` - Tai lieu" vào dự án, người được giao việc thành thành viên dự án, 2 thư mục toàn công ty "Chính sách công ty"/"Sổ tay nhân viên". Từ 27/10/2026 tải 2 tài liệu thật "Nội quy làm việc.pdf" và "Sổ tay nhân viên.docx" từ `scripts/seed-assets/company-docs/` (bỏ qua nếu đã có cùng tên) rồi mới xoá `noi-quy-lam-viec.txt`/`so-tay-nhan-vien.txt` cũ |
| `node scripts/seed-project-docs.js` | 20 tài liệu mẫu Word/PDF/Excel/PowerPoint (`scripts/seed-assets/project-docs/`) vào thư mục của 5 dự án — bỏ qua tệp đã có cùng tên |
| `node scripts/migrate-demo-ownership.js` | Giao 8 khách hàng cho phòng Kinh doanh (3 Manager, 3 nhân viên demo, 2 nhân viên khác) để CRM của Manager/nhân viên demo có dữ liệu |
| `npm run seed:inventory` | Danh mục sản phẩm, sản phẩm, kho, tồn kho, giao dịch mua hàng (`scripts/seed-inventory.js`) |
| `npm run seed:e2e` | Tổ chức E2E riêng cho bộ Playwright (`scripts/seed-e2e.js`) |
| `node scripts/mock-data/mkfixtures.js` | Sinh lại bộ file mẫu ở `scripts/mock-data/fixtures/` (mục 3) |

Kịch bản trong `scripts/mock-data/` **không cần** dữ liệu nào ngoài 3 lệnh seed trên — chúng tự tạo dữ
liệu tạm của mình rồi tự xoá.

Dữ liệu tài liệu của tổ chức demo sau đợt dọn kho 27–28/10/2026 (`Technical_Spec.md` §29.4): **22 tệp** (20
tài liệu dự án + 2 tài liệu công ty), 7 thư mục, 0 tệp `.txt/.csv`, RAG lập chỉ mục 12 tệp / 286 đoạn. Kịch bản
04 kết thúc phải để lại đúng các con số này.

## 3. Bộ file mẫu (`scripts/mock-data/fixtures/`)

| File | Nội dung | Kết quả mong đợi khi tải lên |
|---|---|---|
| `t1-quy-dinh-bao-mat.pdf` (800 B) | PDF 1 trang hợp lệ, có văn bản (mã truy cập `LAB-7731`) | 201, được lập chỉ mục RAG, tải xuống đúng từng byte |
| `t1-so-tay-phuc-loi.docx` (~1,7 KB) | DOCX hợp lệ (hỗ trợ gửi xe 2 triệu/quý) | 201, được lập chỉ mục RAG |
| `t1-hong.pdf` (89 B) | Chuỗi rác có header `%PDF` | 201 (tệp vẫn được lưu); trình trích văn bản bỏ qua với cảnh báo `Invalid PDF structure`, service không sập |
| `t1-hong.docx` (131 B) | ZIP hợp lệ nhưng thiếu `word/document.xml` | 201; bỏ qua với cảnh báo `Could not find main document part` |
| `t1-zip-bomb.docx` (~68 KB) | ZIP chứa `word/document.xml` 70 MB | 201; bỏ qua vì vượt trần giải nén 30 MB (`DOCX giai nen ra ... vuot tran`) |

File lớn (> 25 MB để thử giới hạn tải lên) được **sinh lúc chạy**, không lưu trong repo.

## 4. Kịch bản kiểm thử và kết quả mong đợi

Mỗi kịch bản in từng dòng `PASS`/`FAIL` và dòng tổng kết `x/y PASS` (mã thoát 1 nếu có FAIL).

### 4.1. `01-auth-iam.js` — Xác thực và quản trị

- Đăng nhập 4 vai trò → 200, JWT đúng vai trò; sai mật khẩu → 401; không token → 401.
- Refresh token qua cookie HttpOnly `ecap_refresh_token` → access token mới; logout → refresh token cũ
  bị từ chối (401). Access token là JWT stateless nên vẫn dùng được tới khi hết hạn (đúng thiết kế).
- Quên mật khẩu → email trong MailHog (kịch bản **không** đặt lại mật khẩu để giữ mật khẩu demo; xoá
  email sau khi kiểm tra).
- Employee xem được danh bạ (`GET /users`) nhưng không xem được hồ sơ người khác (403); Manager không
  vào được `/roles` (403); Org Admin không gọi được `/platform-admin` (403).
- Org Admin tạo phòng ban, mời thành viên (đăng nhập được), đổi vai trò, vô hiệu hoá (không đăng nhập
  được nữa). Super Admin xem danh sách tổ chức và thống kê.

### 4.2. `02-hrm.js` — Chấm công, nghỉ phép, tăng ca, lịch

- Check-in thiếu ảnh → 400; vĩ độ ngoài miền → 400; có ảnh + GPS → **201**; check-in lần 2 → 400
  `ALREADY_CHECKED_IN_TODAY`. *(28/10/2026)* Điểm khuôn mặt chỉ được nhận qua token do ml-service ký
  (`faceMatchToken`, Technical_Spec.md §24): check-in gửi `faceMatchScore=0.99` kèm token giả và check-out
  gửi `faceMatchScore=0.9` đều phải ra `checkIn/checkOutFaceMatched = null` (điểm bị bỏ qua, chấm công vẫn
  thành công). `checkInIsOnSite` là `null` khi chưa cấu hình `OFFICE_LATITUDE/LONGITUDE`.
- Employee tạo đơn nghỉ phép (ngày ở tương lai xa) → PENDING; tự duyệt → 403; Manager thấy đơn và duyệt
  → APPROVED; Employee nhận thông báo real-time (outbox → Kafka → notification-service) trong ≤ 15 giây.
- Employee đăng ký tăng ca → Manager từ chối; Employee tạo ngày lễ → 403; Manager tạo được.
- **Điều kiện:** nhân viên phải chưa chấm công hôm nay (nếu đã có, bước check-in được bỏ qua và không
  xoá bản ghi có sẵn).

### 4.3. `03-projects.js` — Dự án và công việc

Manager tạo dự án, thêm Employee, giao việc; Employee kéo TODO → DOING → DONE, bình luận; trạng thái sai
→ 400; Employee xoá việc/dự án → 403; lịch sử trạng thái có ≥ 2 bản ghi; xoá dự án → 404.

### 4.4. `04-documents.js` — Tài liệu, thư mục RESTRICTED lồng nhau, RAG

Cây dữ liệu Manager tạo:

```
R  "Kho mật"            RESTRICTED
├─ C  "Con của kho mật"   (ORGANIZATION, kế thừa hạn chế)   fSalary, fDirect (chia sẻ file cho Employee)
│  └─ G  "Cháu"                                           fGrand
└─ SH "Con được chia sẻ"  (FolderShare cho Employee)       fShared
O  "Công khai"           ORGANIZATION   PDF, DOCX, file hỏng, zip bomb, file của Employee
CW "Toàn công ty"        (Org Admin tạo, không gắn dự án)
```

**Cập nhật 26/10/2026 (tài liệu theo phạm vi dự án):** thư mục cấp gốc của Manager (R, O) phải gắn dự án,
nên kịch bản lấy 1 dự án chung của Manager và Employee qua `GET /folders/accessible-projects` rồi gắn R và
O vào đó; thư mục con kế thừa. Kiểm tra mới (tổng 55):

| Kiểm tra | Mong đợi |
|---|---|
| Có dự án chung Manager/Employee | có |
| Manager tạo thư mục toàn công ty (không gắn dự án) | 403 `COMPANY_WIDE_ADMIN_ONLY` |
| Org Admin tạo thư mục toàn công ty CW | 201 |
| Employee tải lên CW / tạo thư mục con trong CW | 403 `COMPANY_WIDE_READ_ONLY` / 403 |
| Employee liệt kê tệp trong CW | 200 (vẫn xem được) |
| Org Admin chia sẻ CW cho Employee, Employee tải lên lại | 201 (chia sẻ thư mục tường minh vẫn là quyền ghi) |


| Kiểm tra (Employee) | Mong đợi |
|---|---|
| `GET` fSalary (C), fGrand (G) | 403 — thư mục con/cháu kế thừa hạn chế của R |
| `GET` fDirect (chia sẻ file trực tiếp), fShared (thư mục SH được chia sẻ) | 200 |
| Liệt kê file trong C, G | 403; trong SH: 200 |
| Danh sách thư mục gốc | không thấy R |
| Đổi tên C, tải xuống fGrand | 403 |
| Chia sẻ VIEW: tải phiên bản mới / tự nâng quyền EDIT | 403 (sửa lỗi 24/10/2026); sau khi Manager nâng lên EDIT: tải phiên bản mới được |
| Xoá file (Employee không có `document:delete`) | 403 |
| RAG `search-chunks` nội dung fSalary | không trả về fSalary; Manager tìm thấy |

Manager/Org Admin đọc được mọi file trong R. Ngoài ra: tải lên > 25 MB → 413; PDF tải xuống qua URL tạm
(presigned MinIO) khớp từng byte; phiên bản 2 có `currentVersion = 2`; document-service vẫn sống sau
file hỏng/zip bomb.

### 4.5. `05-crm-inventory.js` — CRM và Kho

Employee tạo khách hàng → 403; Manager tạo khách hàng rồi giao cho Employee phụ trách; Employee tạo deal
(NEW → PROPOSAL), giai đoạn sai → 400, xoá deal → 403; Manager chốt WON. Kho: SKU trùng → 409; nhập 20;
xuất vượt tồn → 4xx; Employee ghi nhận giao dịch mua 3 → tồn còn 17; Employee xoá giao dịch → 403.

### 4.6. `06-analytics-messaging.js` — Báo cáo, ML, thông báo, nhắn tin

Org Admin/Manager xem 8 biểu đồ dashboard (200), Employee → 403; drill-down theo dự án; scope sai → 400;
`GET /analytics/ai-insights` (dùng cache Redis 30 phút; cache trống thì gọi Gemini 1 lần, Gemini lỗi
thì trả nhận xét dự phòng, vẫn 200). ML: Manager chạy phát hiện bất thường `range=30d` → 200,
Employee → 403, `range=1y` → 422. DLQ: Org Admin 200, Manager 403. Nhắn tin 1:1 Manager ↔ Employee: mở lại
trả về cùng cuộc trò chuyện, tin rỗng → 400, người ngoài cuộc → 403/404, xoá tin người khác → 403.

### 4.7. `07-chatbot.js` và `08-chatbot-security.js` — Chatbot (tốn hạn ngạch Gemini)

- 07 phần 1 (không tốn hạn ngạch): Manager đọc/hỏi/xoá cuộc trò chuyện của Employee → 404; Super Admin →
  403; câu hỏi rỗng/chỉ khoảng trắng/1001 ký tự → 400; `limit=501` → 400.
- 07 phần 2 (2 câu): "Tôi còn bao nhiêu ngày phép năm nay?" → gọi tool `get_my_leave_balance`, trả đúng
  12 / đã dùng 2 / còn 10; "Tôi đang có những công việc nào chưa hoàn thành?" → `get_my_tasks`.
- 08 (~4 câu): tài liệu chứa prompt injection → bot trả đúng 350.000 đồng/ngày, có trích dẫn nguồn, không
  làm theo chỉ dẫn nhúng; biên bản mật trong thư mục RESTRICTED → không lộ cho Employee; xoá cuộc trò
  chuyện khi đang trả lời → 404 (không 500); 2 câu đồng thời → 201 + 409 `CHATBOT_CONVERSATION_BUSY`, hạn
  ngạch chỉ tăng 1.
- **26/10/2026:** 08 tạo 2 thư mục ("Công khai", "Hạn chế") gắn 1 dự án chung của Manager và Employee thay
  vì thư mục toàn công ty, và tải tài liệu injection vào thư mục đó (Employee không còn tải được lên thư mục
  gốc); dọn dẹp xoá tệp của Employee **trước** khi xoá thư mục.

### 4.8. `09-ui-smoke.js` — Giao diện (Playwright)

Mỗi vai trò mở các trang chính (26 lượt, nghỉ 2,5 giây giữa các trang): không lỗi JS, không phản hồi
API 5xx. Org Admin mở ma trận phân
quyền: có nhóm "Sản phẩm & Kho", "Nhắn tin & Trợ lý AI", không còn nhóm "Khác"; bật/tắt `chatbot:use`
của Employee lưu vào IAM rồi trả về trạng thái ban đầu. Kịch bản đếm riêng số phản hồi 429 (rate-limit
của Gateway) và chờ hết cửa sổ 60 giây trước khi kiểm tra ma trận phân quyền nếu có 429.

### 4.9. `10-employee-directory.js` — Danh sách nhân viên & ảnh nhận diện *(bổ sung 26/10/2026)*

- **A. Danh sách + hợp đồng DTO:** Org Admin thấy cả tổ chức; Manager Kinh doanh chỉ thấy Employee phòng
  mình; Employee và Super Admin nhận 403; `GET /users` không bao giờ có `phoneNumber`/`employeeCode`.
- **B. Hồ sơ:** số điện thoại được chuẩn hoá hoặc bị từ chối; mã NV trùng (khác hoa thường) → 409; mời không
  mật khẩu → email kích hoạt trong MailHog có link `/reset-password?token=`, không chứa mật khẩu; Manager mời
  → phòng ban bị ép về phòng của Manager.
- **C. Avatar:** chính chủ và Manager → Employee phòng mình được; Manager → phòng khác/Org Admin, Employee →
  người khác: 403; URL presigned tải được.
- **D. Ảnh nhận diện:** Manager tải hộ → bản chờ không được verify → nhân viên xác nhận → verify khớp; trùng
  1:N → 409; nhân viên từ chối → tải hộ 409; proxy ảnh `no-store` + nhật ký `VIEW_REF`; Manager phòng khác
  403.
- **D7a/D7b (28/10/2026):** sau khi verify khớp, nhân viên thử check-in bằng đúng ảnh kèm `faceMatchToken` → khớp,
  điểm bằng điểm verify; check-out bằng ảnh khác nhưng dùng lại token đó → điểm bị bỏ qua, chấm công vẫn 201. Bản
  ghi chấm công và ảnh của 2 bước này bị xoá ở phần dọn dẹp.
- **E. Vòng đời:** vô hiệu hoá → ml-service xoá bản dùng, đồng ý và object MinIO.

Ảnh khuôn mặt **không nằm trong repo**. Phần D/E cần biến `ECAP_FACE_FIXTURES` trỏ tới thư mục có
`person_a.jpg`, `person_a2.jpg`, `person_b.jpg`, `two_faces.jpg`; thiếu biến thì D/E bị bỏ qua (chỉ chạy
17 kiểm tra). Sinh thư mục này từ ảnh mẫu của `apps/ml-service/tests/face_fixtures.py` (ảnh tổ bay STS-130
của NASA, phạm vi công cộng; cần có sẵn 2 model và `models/sample_crew_for_tests.jpg` như job CI
`ml-service-test`):

```bash
cd apps/ml-service
python -c "from pathlib import Path; from tests import face_fixtures as f; o=Path('../../.face-fixtures'); o.mkdir(exist_ok=True); [ (o/n).write_bytes(g()) for n,g in [('person_a.jpg',f.person_a),('person_a2.jpg',f.person_a_variant),('person_b.jpg',f.person_b),('two_faces.jpg',f.two_faces)] ]"
```

Dọn dẹp: xoá vĩnh viễn 2 tài khoản thử, trả lại số điện thoại/avatar của Employee demo, xoá nhật ký,
`fact_user_activity` và email MailHog do kịch bản tạo. Kịch bản không nằm trong `run-all.js`, chạy riêng.

## 5. Cách chạy

Điều kiện: stack Docker đang chạy, Node ≥ 18 (dùng `fetch` có sẵn), Docker CLI trên máy chạy kịch bản
(phần dọn dẹp dùng `docker exec`), đã `npm install` ở gốc repo và trong `e2e/` (cho kịch bản 09).

```bash
node scripts/mock-data/run-all.js              # 01 → 07 (phần 1), không tốn hạn ngạch Gemini
node scripts/mock-data/run-all.js --with-llm   # thêm 07 phần 2 và 08 (~6 lượt Gemini)
node scripts/mock-data/04-documents.js         # chạy riêng 1 kịch bản
node scripts/mock-data/07-chatbot.js manager "Câu hỏi 1" "Câu hỏi 2"   # hỏi tuỳ ý (mỗi câu 1 lượt)
node scripts/mock-data/09-ui-smoke.js          # giao diện, chạy riêng
```

Biến môi trường (mặc định là giá trị demo): `ECAP_API_BASE` (`http://127.0.0.1:3000/api/v1`),
`ECAP_WEB_URL` (`http://localhost`), `ECAP_MAILHOG_URL` (`http://127.0.0.1:8025`), `ECAP_PASSWORD`,
`ECAP_ADMIN_EMAIL`, `ECAP_MANAGER_EMAIL`, `ECAP_EMPLOYEE_EMAIL`, `ECAP_SUPERADMIN_EMAIL`,
`ECAP_SUPERADMIN_PASSWORD`.

## 6. Cơ chế dọn dẹp

| Loại dữ liệu | Cách xoá |
|---|---|
| Phòng ban, thành viên, dự án, công việc, thư mục, tệp, khách hàng, deal, sản phẩm, danh mục, kho, giao dịch, ngày lễ, tin nhắn, cuộc trò chuyện chatbot | API (`DELETE`) |
| Bản ghi chấm công, đơn nghỉ phép/tăng ca (không có API xoá, có chủ đích) | `postgres-hrm` + ảnh chấm công trong MinIO (`mc rm`) |
| Sổ cái nhập/xuất kho, tồn kho của kho kiểm thử | `postgres-inventory` (trước khi xoá kho/sản phẩm) |
| Cuộc trò chuyện nhắn tin do kịch bản tạo mới (API chỉ xoá mềm tin nhắn) | `postgres-messaging` |
| Sự kiện phân tích (`fact_*` trong TimescaleDB), thông báo (MongoDB), email MailHog | `purgeTraces()` trong `lib.js`: xoá bản ghi chứa id do kịch bản tạo, kể từ lúc bắt đầu chạy |

Ngoại lệ còn lại có chủ đích: bộ đếm hạn ngạch chatbot theo ngày (`chatbot_daily_usage`) và sự kiện
đăng nhập trong `fact_user_activity` (hoạt động sử dụng bình thường).

## 7. Nguồn gốc kịch bản

Bộ kịch bản được gom từ 2 đợt kiểm thử Chatbot RAG trước đó và đợt nghiệm thu 24/10/2026, chuyển sang đọc
URL/tài khoản từ biến môi trường, bỏ mọi đường dẫn tuyệt đối và bổ sung dọn dẹp:

| File | Gom từ |
|---|---|
| `lib.js` | helper gọi API + tải tệp của 2 đợt kiểm thử, thêm bộ đếm PASS/FAIL và hàm dọn dẹp CSDL |
| `mkfixtures.js` + `fixtures/` | trình sinh file mẫu PDF/DOCX hợp lệ và hỏng, thêm sinh zip bomb |
| `04-documents.js` | kịch bản dựng thư mục RESTRICTED, kế thừa quyền thư mục cha, file hỏng |
| `07-chatbot.js` | kịch bản phân quyền/validate chatbot + công cụ hỏi nhanh |
| `08-chatbot-security.js` | kịch bản prompt injection/rò rỉ tài liệu hạn chế + kiểm tra đồng thời |
| `01`–`03`, `05`, `06`, `09`, `run-all.js` | viết mới trong đợt nghiệm thu 24/10/2026 |

## 8. Kết quả lần chạy 24/10/2026

| Kịch bản | Kết quả |
|---|---|
| 01 Auth + IAM | 31/31 PASS (quên mật khẩu PASS sau khi sửa route công khai của Gateway) |
| 02 HRM | 28/28 PASS |
| 03 Dự án/công việc | 18/18 PASS |
| 04 Tài liệu | 46/46 PASS (sau khi sửa lỗi chia sẻ VIEW được ghi đè/xoá/nâng quyền) |
| 05 CRM + Kho | 27/27 PASS |
| 06 Analytics + nhắn tin | 24/24 PASS |
| 07 Chatbot | 16/16 PASS |
| 08 Chatbot an toàn | 12/12 PASS |
| 09 Giao diện | 32/32 PASS (lần đầu ghi nhận 50 phản hồi 429 khi duyệt 26 trang với giới hạn cũ 100 request/phút cho cả tổ chức + IP; Gateway đã chuyển sang giới hạn theo người dùng 300 request/phút, chạy lại: 0 phản hồi 429) |

Bộ Playwright `e2e/` (tổ chức E2E, chạy `--retries=0`, bỏ test POST `ai-insights` vì tốn hạn ngạch Gemini):
11/17 PASS. 6 test giao diện thất bại vì **selector cũ** so với giao diện hiện tại (vd nút "Dự án mới" đã
đổi thành "Tạo dự án", trang Tài liệu mặc định ở chế độ Lưới thay vì bảng, thẻ chấm công ghi "Vào làm"
thay vì "Đã vào làm lúc", tên dự án seed có dấu); ảnh chụp lúc lỗi cho thấy thao tác thực tế vẫn thành
công (tệp đã tải lên, đã check-in). Cần cập nhật lại các spec này.

Lỗi do bộ kịch bản phát hiện và đã sửa trong đợt (mỗi lỗi có unit test đi kèm):

- Ma trận phân quyền (web) thiếu 20 quyền ra đời sau (chatbot, Kho, Nhắn tin, giải trình/tăng ca, lịch,
  `ml:view`) — trước đây rơi vào nhóm "Khác" với nhãn là key kỹ thuật.
- Chia sẻ tệp quyền VIEW vẫn tải được phiên bản mới, xoá tệp và tự nâng quyền lên EDIT (document-service).
- Vai trò Org Admin của các tổ chức đăng ký trước khi có quyền mới không bao giờ nhận quyền đó (tổ chức
  E2E thiếu 12 quyền, 10 tổ chức khác thiếu `chatbot:use`); iam-service nay bổ sung lúc khởi động.
- Quên mật khẩu bị Gateway chặn 401 (thiếu route công khai) và rate-limit 100 request/phút dùng chung cả
  tổ chức + IP (đã chuyển sang theo người dùng).

## 9. Kết quả lần chạy 26/10/2026 (tài liệu theo dự án + phạm vi Manager)

| Kịch bản | Kết quả |
|---|---|
| 01 Auth + IAM | 31/31 PASS |
| 02 HRM | 28/28 PASS |
| 03 Dự án/công việc | 18/18 PASS |
| 04 Tài liệu | 55/55 PASS (trước khi sửa kịch bản: 36/40 — do chính sách mới, không phải lỗi hệ thống) |
| 05 CRM + Kho | 27/27 PASS (chạy lại sau khi giao 8 khách hàng cho phòng Kinh doanh: vẫn 27/27) |
| 06 Analytics + nhắn tin | 24/24 PASS |
| 07 Chatbot | 12/12 PASS (không gọi Gemini) |
| 08 Chatbot an toàn | 12/12 PASS (bot trả đúng 350.000 đồng/ngày, không làm theo chỉ dẫn nhúng, không lộ biên bản mật) |

Kiểm tra sống riêng của đợt (script tạm, dữ liệu đã dọn):

- **Đường ghi/đọc theo id ngoài phạm vi** — Manager phòng Kỹ thuật (`bao.tran+167828`), Employee và Manager
  phòng Kinh doanh trên dự án của Org Admin: dự án (xem, thành viên, sửa, đổi người phụ trách, hoàn thành, mở
  lại, lưu trữ, xoá, thêm/gỡ thành viên), Task (xem, bình luận, lịch sử, sửa, đổi trạng thái, giao/bỏ giao,
  tạo, xoá, lọc theo dự án), CRM (khách hàng/deal của Org Admin), Analytics phòng khác, HRM duyệt đơn phòng
  khác và tự duyệt → **92/92** (404/403 đúng, dữ liệu không đổi).
- **Gỡ thành viên còn Task chưa xong** → 409 `PROJECT_MEMBER_HAS_OPEN_TASKS` (`count = 1`), xong Task → gỡ
  được, người bị gỡ mất quyền xem dự án; **cờ `canWrite` từng tệp** trong cây toàn công ty: tệp được chia sẻ
  EDIT → `true` và tải phiên bản mới 201, tệp còn lại `false` và 403 → **17/17**.
- **20 tài liệu mẫu** — số tài liệu Office/PDF thấy được theo dự án (4 mỗi dự án):

| Dự án | Org Admin | Manager Kinh doanh | Employee `duc.hoang+227860` | Manager Kỹ thuật | Employee `an.nguyen+216140` (chưa thuộc dự án nào) |
|---|---|---|---|---|---|
| 5 dự án demo | 4 | 4 | 4 | 4 | 0 (không xem được dự án) |

  Mọi ô đều thoả "thấy tài liệu dự án ⇔ thấy dự án". `search-chunks` "Cách tính tỷ lệ hoàn thành công việc
  trong từ điển chỉ số KPI" trả 3 đoạn của "Từ điển chỉ số KPI và cách tính trên ECAP.docx" (điểm 0,79–0,83)
  cho Employee/Manager thuộc dự án, 0 đoạn cho `an.nguyen+216140` → **28/28**. Dữ liệu demo hiện có mọi dự
  án đều có người của cả phòng Kinh doanh lẫn Kỹ thuật, nên trường hợp "ngoài phạm vi" thể hiện qua tài khoản
  chưa thuộc dự án nào.
- **CRM sau khi giao khách hàng demo** (khách hàng/deal): Org Admin 24/48, Manager Kinh doanh 8/16, Employee
  `duc.hoang+227860` 3/6, Employee `an.nguyen+216140` 2/4, Manager Kỹ thuật 0/0.

## 10. Kết quả lần chạy 26/10/2026 (danh sách nhân viên & ảnh nhận diện)

| Kịch bản | Kết quả |
|---|---|
| 10 Danh sách nhân viên & ảnh nhận diện | 45/45 PASS (có `ECAP_FACE_FIXTURES`); 17/17 khi không có ảnh (bỏ qua D/E) |
| 01–07 (hồi quy sau khi Gateway xoá header tin cậy) | 31 + 28 + 18 + 55 + 27 + 24 + 12 = 195/195 PASS |

Kiểm tra sống riêng: gửi header tin cậy giả qua Gateway (hoa thường lẫn lộn, header trùng tên, `x-roles` +
`x-is-super-admin`, `x-department-id` phòng khác, `x-organization-id`, `x-user-id`, `x-internal-secret`;
Manager Kinh doanh giả phòng Kỹ thuật; Analytics phòng khác) → **10/10** bị chặn hoặc bị bỏ qua đúng.

## 11. Kết quả lần chạy 28/10/2026 (xem trước tài liệu, dọn kho demo, chụp ảnh bằng camera)

Chạy trên bản `web` production build lại (`Technical_Spec.md` §29), sau khi dọn kho tài liệu demo.

| Kịch bản | Kết quả |
|---|---|
| 01 Auth + IAM | 31/31 PASS |
| 02 HRM | 22/22 PASS (nhân viên demo đã chấm công hôm đó nên kịch bản tự bỏ nhánh check-in/check-out) |
| 03 Dự án/công việc | 18/18 PASS |
| 04 Tài liệu | 55/55 PASS — dọn dẹp xong còn 22 tệp, 7 thư mục, 286 đoạn RAG |
| 05 CRM + Kho | 27/27 PASS |
| 06 Analytics + nhắn tin | 24/24 PASS |
| 07 Chatbot | 12/12 PASS (không gọi Gemini) |
| 10 Danh sách nhân viên & ảnh nhận diện | 45/45 PASS (có `ECAP_FACE_FIXTURES`). Lần chạy đầu 16/17 do `fetch failed` (ECONNRESET của `wslrelay` trên `127.0.0.1:3000`, không liên quan thay đổi), khối `finally` vẫn dọn sạch; chạy lại 45/45 |

Kiểm tra sống riêng của đợt (script tạm, chỉ đọc; hội thoại Chat bot phục vụ từ trình duyệt, 0 lượt Gemini;
mọi yêu cầu tải/đăng ký ảnh khuôn mặt bị chặn trong trình duyệt) — **45/45**:

- Org Admin: mở PDF/DOCX/XLSX/PPTX ở dạng bảng, dạng lưới, mục "Tài liệu" của dự án CRM và 2 tài liệu công ty →
  cửa sổ xem trước có nội dung, không mở tab, không tải tệp, 0 lỗi console; "Tải xuống" trong cửa sổ → 1 tab
  + tệp đúng tên (`disposition=attachment`); 390px: không tràn ngang, cửa sổ x=16 w=350.
- Employee `duc.hoang+227860`: 2 thư mục công ty không có nút tải lên/thư mục mới, xem được cả 2 tài liệu.
- Employee `kien.dinh+167828` (không thuộc dự án "Hệ thống báo cáo KPI"): chip nguồn tài liệu KPI → 403 + toast
  "Bạn không có quyền truy cập tệp này.", không mở cửa sổ; Esc khi chip đang tải → panel đóng, không cửa sổ nào
  bật lên sau đó.
- Manager `an.nguyen+227860` → Hồ sơ Hoàng Văn Đức → hộp tải ảnh → "Chụp bằng camera" (camera giả của Chromium)
  → `/ml/face/inspect` trả `FACE_NONE`, "Gửi ảnh" bị khoá; Escape chỉ đóng camera, lần 2 đóng hộp tải ảnh, lần 3
  đóng hồ sơ. Không ảnh nào được gửi cho nhân viên demo.
- Tệp độc hại (thay nội dung URL presigned trong trình duyệt): `.docx` 100.000 đoạn → báo lỗi sau 0,39 giây;
  `.docx` 20.000 đoạn → hiển thị; `.xlsx` rỗng / HTML đổi đuôi → báo lỗi; `.xlsx` 2.000 × 120 → hiển thị.
- `e2e/tests/documents.spec.ts` (tổ chức E2E, đã sửa theo cửa sổ xem trước): 1/1 PASS.


## Lịch sử thay đổi file này

- 24/10/2026: khởi tạo tài liệu — tài khoản theo vai trò, bộ file mẫu, 9 kịch bản kiểm thử sống kèm kết
  quả mong đợi, cơ chế dọn dẹp và kết quả đợt nghiệm thu toàn hệ thống.
- 26/10/2026: tài liệu theo phạm vi dự án + phạm vi dữ liệu của Manager — mục 2 thêm 3 script dữ liệu (migration,
  20 tài liệu mẫu, giao khách hàng demo); mục 4.4 cây thư mục gắn dự án + 7 kiểm tra mới của 04; mục 4.7 thay
  đổi của 08; mục 9 (mới) kết quả chạy lại và các kiểm tra sống của đợt.
- 26/10/2026 (tiếp): danh sách nhân viên & kho ảnh nhận diện — mục 4.9 (mới) kịch bản `10-employee-directory.js`
  và cách sinh thư mục ảnh `ECAP_FACE_FIXTURES` (ảnh khuôn mặt không nằm trong repo); mục 10 (mới) kết quả chạy
  và kiểm tra giả mạo header qua Gateway.
- 28/10/2026: xem trước tài liệu trong ứng dụng, dọn kho tài liệu demo, chụp ảnh nhận diện bằng camera — mục 2:
  `seed.js` không còn tải 15 tệp `.txt/.csv` mẫu, `migrate-project-documents.js` tải "Nội quy làm việc.pdf"/"Sổ tay
  nhân viên.docx" từ `scripts/seed-assets/company-docs/` và xoá 2 tệp `.txt` cũ, ghi số liệu tài liệu demo hiện có
  (22 tệp, 7 thư mục, 12 tệp / 286 đoạn RAG); mục 11 (mới) kết quả chạy lại 01–07, 10 và các kiểm tra sống của đợt.
