# Wireframe — Enterprise Collaboration & Analytics Platform for SMEs

**Tài liệu liên quan:** [General_idea.md](General_idea.md) · [Technical_Spec.md](Technical_Spec.md)
**Ngày khởi tạo:** 18/07/2026
**Mức độ:** Low-fidelity (wireframe văn bản/ASCII) — mô tả bố cục và luồng, chưa phải thiết kế UI cuối cùng.

---

## 0. Quy ước chung

- **Ngôn ngữ giao diện:** Tiếng Việt mặc định; thuật ngữ kỹ thuật/tên riêng (Dashboard, Kanban, Task, Upload...) giữ nguyên tiếng Anh khi đã quen dùng trong ngành. **(Bổ sung 20-21/08/2026)** Người dùng có thể đổi sang English/日本語 bất kỳ lúc nào qua nút chọn ngôn ngữ (icon địa cầu 🌐) — góc trên-phải màn Đăng nhập/Đăng ký (mục 1), cạnh chuông thông báo trên Topbar ở mọi trang đã đăng nhập (mục 2). Lựa chọn được ghi nhớ cho lần mở lại sau. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §18.
- **Component base:** shadcn/ui (dựa trên Radix + TailwindCSS) — dùng chung bộ Button/Input/Modal/Table/Toast xuyên suốt để đảm bảo nhất quán.
- **Bố cục khung (shell):** Sidebar trái cố định + Topbar trên + vùng nội dung chính — áp dụng cho mọi trang sau khi đăng nhập.
- **Thời gian hiển thị:** toàn bộ mốc thời gian hiển thị theo GMT+7, định dạng `dd/MM/yyyy HH:mm`.
- **Trạng thái tải dữ liệu:** mọi bảng/danh sách đều có 3 trạng thái — loading (skeleton), empty (empty-state kèm CTA), error (thông báo + nút thử lại).
- **Responsive:** breakpoint chính ở `768px` (mobile) và `1024px` (tablet/desktop) — chi tiết ở [mục 10](#10-ghi-chú-responsive).

---

## 1. Trang Đăng nhập / Đăng ký tổ chức

```
┌───────────────────────────────────────────────────────────┐
│                                                             │
│                     [Logo nền tảng]                        │
│                                                             │
│           ┌─────────────────────────────────┐              │
│           │  Đăng nhập                       │              │
│           │  ─────────────────────────────   │              │
│           │  Email tổ chức    [____________] │              │
│           │  Mật khẩu         [____________] │              │
│           │                                   │              │
│           │           [   Đăng nhập   ]       │              │
│           │                                   │              │
│           │  Quên mật khẩu?  |  Đăng ký tổ chức mới          │
│           └─────────────────────────────────┘              │
│                                                             │
└───────────────────────────────────────────────────────────┘
```

- **Đăng ký tổ chức mới** (multi-step): (1) Thông tin tổ chức (tên, mã số thuế tùy chọn) → (2) Tài khoản Org Admin đầu tiên (email, mật khẩu) → (3) Hoàn tất, chuyển vào Dashboard rỗng kèm gợi ý "mời thành viên" / "tạo dự án đầu tiên".
- Sau đăng nhập thành công, JWT lưu ở memory + refresh token ở httpOnly cookie (không lưu access token ở `localStorage` để giảm rủi ro XSS).
- **(Bổ sung 20/08/2026)** Ô mật khẩu có nút hiện/ẩn riêng của ứng dụng (icon con mắt) — tự vẽ bằng React thay vì dựa vào nút "reveal password" có sẵn của trình duyệt (từng mất đồng bộ với state, xem `Technical_Spec.md` mục 2026-08-20). Nếu phát hiện dấu tiếng Việt trong mật khẩu đang gõ (thường do bộ gõ tự động ghép dấu ngoài ý muốn), hiện 1 dòng cảnh báo nhỏ ngay dưới ô — chỉ cảnh báo, không chặn ký tự.
- **(Bổ sung 20-21/08/2026)** Nút chọn ngôn ngữ (🌐) cố định ở góc trên-phải màn hình này — xem mục 0.

## 2. Khung bố cục tổng thể (App Shell)

```
┌──────────┬──────────────────────────────────────────────────┐
│          │  Topbar: [🔍 Tìm kiếm]  [🌐] [🔔 3] [Tên user ▾]  │
│ Sidebar  ├──────────────────────────────────────────────────┤
│          │                                                  │
│ ▣ Dashboard                                                 │
│ ▣ Dự án & Công việc      Vùng nội dung chính                │
│ ▣ Tài liệu               (thay đổi theo route)               │
│ ▣ Thông báo                                                  │
│ ▣ Báo cáo & Phân tích                                        │
│ ─────────                                                    │
│ ▣ Quản trị (chỉ Org Admin)                                   │
│          │                                                  │
│ [Tên tổ chức ▾]                                              │
└──────────┴──────────────────────────────────────────────────┘
```

- Sidebar có thể thu gọn (collapse) chỉ còn icon trên tablet.
- Chuông thông báo (🔔) hiển thị badge số lượng chưa đọc, cập nhật real-time qua WebSocket không cần reload.
- **[Tên user ▾]** mở menu: **Hồ sơ cá nhân** (mục 11) và **Đăng xuất**.
- **(Bổ sung 20-21/08/2026)** Icon **[🌐]** mở nút chọn ngôn ngữ (Tiếng Việt/English/日本語) — xem mục 0.
- **(Bổ sung 22/07/2026)** Ô **[🔍 Tìm kiếm]**: tìm kiếm tổng hợp, gõ tối thiểu 1 ký tự (debounce 300ms) → hiển thị kết quả nhóm theo loại (Dự án / Công việc / Thành viên / Tài liệu — tên thư mục cấp gốc), so khớp chuỗi con không phân biệt hoa/thường, hoàn toàn phía client trên dữ liệu đã tải sẵn (không gọi endpoint tìm kiếm riêng, phù hợp quy mô SME — xem Technical_Spec.md §14 về giới hạn: chưa tìm theo nội dung/tên tệp bên trong thư mục con). Click 1 kết quả điều hướng thẳng tới trang tương ứng.

## 3. Dashboard tổng quan

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard tổng quan                    [Khoảng thời gian ▾]  │
├───────────────┬───────────────┬───────────────┬──────────────┤
│ Tổng công việc │ Tỷ lệ hoàn    │ Tài liệu mới  │ Thành viên    │
│      128       │ thành: 72%    │ tuần này: 14  │ hoạt động: 23 │
│  (KPI card)    │  (KPI card)   │  (KPI card)   │  (KPI card)   │
├───────────────┴───────────────┴──────────────────────────────┤
│  Xu hướng hoàn thành công việc theo tuần        [Line chart]  │
│   ╭─╮        ╭──╮                                             │
│   │ ╰╮   ╭──╮│  ╰╮  ╭──                                       │
│  ─╯  ╰───╯  ╰╯   ╰──╯                                         │
├───────────────────────────────┬──────────────────────────────┤
│ Trạng thái công việc hiện tại  │ Hoạt động gần đây (real-time) │
│   [Donut: Todo/Doing/Done]     │  • An vừa hoàn thành "Task X" │
│                                 │  • Bình tải lên "Báo cáo Q3"  │
│                                 │  • Chi được giao "Task Y"     │
└───────────────────────────────┴──────────────────────────────┘
```

- KPI card + biểu đồ nạp dữ liệu ban đầu qua REST (`GET /api/v1/analytics/summary`), sau đó nhận cập nhật tăng dần qua WebSocket (không poll lại toàn bộ).
- Feed "Hoạt động gần đây" là danh sách event thô gần nhất (giới hạn 20 item), khác với Notification cá nhân (mục 6).
- Bộ lọc "Khoảng thời gian" (7 ngày / 30 ngày / Quý) áp dụng cho toàn bộ chart trên trang, không riêng lẻ từng biểu đồ.
- **(Bổ sung 28/07/2026) Bộ lọc "Phòng ban"** đặt cạnh bộ lọc "Khoảng thời gian" — áp dụng cho 4 KPI card và biểu đồ "Trạng thái công việc hiện tại", **KHÔNG áp dụng** cho "Xu hướng hoàn thành công việc theo tuần" (giới hạn kỹ thuật đã ghi nhận, xem Technical_Spec.md §4.6). Đây là lần thứ 2 xuất hiện bộ lọc này — lần đầu (trước 18/07/2026) đã bị gỡ khỏi trang này và trang Dự án vì `Project`/`Task` chưa lưu được `departmentId`; nay quay lại đúng cách qua bảng chiều `dim_user` bên Analytics Service.

## 4. Module Dự án & Công việc

### 4.1 Danh sách dự án
```
┌──────────────────────────────────────────────────────────────┐
│ Dự án & Công việc                          [+ Tạo dự án mới]  │
├──────────────────────────────────────────────────────────────┤
│ [Tìm kiếm dự án___________]     [Trạng thái ▾]                │
├──────────────────────────────────────────────────────────────┤
│ ▸ Website bán hàng SME        ▓▓▓▓▓▓▓░░░ 68%   5 thành viên   │
│ ▸ Triển khai CRM nội bộ       ▓▓░░░░░░░░ 20%   3 thành viên   │
│ ▸ Nâng cấp hạ tầng Docker     ▓▓▓▓▓▓▓▓▓░ 90%   2 thành viên   │
└──────────────────────────────────────────────────────────────┘
```

*(Điều chỉnh 21/07/2026: bỏ bộ lọc "Phòng ban" khỏi danh sách dự án — `Project` không gắn với phòng ban cụ thể trong kiến trúc hiện tại; xem Technical_Spec.md §14.)*

### 4.2 Bảng Kanban của một dự án
```
┌──────────────────────────────────────────────────────────────┐
│ ← Website bán hàng SME                    [+ Thêm công việc]  │
├───────────────────┬───────────────────┬────────────────────┤
│   TODO (4)         │   DOING (2)        │   DONE (7)          │
├───────────────────┼───────────────────┼────────────────────┤
│ [Task card]         │ [Task card]         │ [Task card]         │
│ Thiết kế trang chủ  │ Tích hợp thanh toán │ Cài đặt project      │
│ 👤 An  🕓 20/07     │ 👤 Bình  🕓 hôm nay │ ✓ Hoàn thành 15/07   │
│                     │                     │                     │
│ [Task card] ...     │ [Task card] ...     │ [Task card] ...     │
└───────────────────┴───────────────────┴────────────────────┘
```

- Kéo-thả (drag & drop) thẻ giữa các cột → gọi `PATCH /api/v1/tasks/:id/status` → phát sự kiện `task.status_changed` → phản ánh gần như tức thời trên Dashboard/Analytics.
- Click vào thẻ mở **Modal chi tiết Task**: mô tả, danh sách người được giao, bình luận (comment thread), lịch sử thay đổi trạng thái.

## 5. Module Tài liệu

```
┌──────────────────────────────────────────────────────────────┐
│ Tài liệu > Phòng Kinh doanh                 [+ Tải lên] [+ Thư mục mới] │
├──────────────────────────────────────────────────────────────┤
│ 📁 Hợp đồng khách hàng                                        │
│ 📁 Báo giá 2026                                                │
│ 📄 Bao-cao-Q3.pdf         2.1 MB   Cập nhật 17/07  [Chia sẻ ▾]│
│ 📄 Ke-hoach-marketing.docx 850 KB  Cập nhật 15/07  [Chia sẻ ▾]│
└──────────────────────────────────────────────────────────────┘
```

- **Modal Tải lên:** kéo-thả file hoặc chọn từ máy → thanh tiến trình upload → validate loại file/kích thước trước khi gửi lên MinIO qua Document Service.
- **Modal Chia sẻ:** chọn user (hoặc **phòng ban**, bổ sung 28/07/2026) được gắn nhãn "đã chia sẻ" — ghi vào `FileShare`. **(Điều chỉnh 21/07/2026, nâng cấp 28/07/2026)** Trong MVP ban đầu, `FileShare` chỉ mang tính hiển thị, không giới hạn quyền truy cập thực tế. **Từ 28/07/2026, đã có access-control thực sự nhưng theo THƯ MỤC (opt-in):** mỗi thư mục có biểu tượng khoá 🔒 khi ở chế độ "Hạn chế truy cập" — chỉ người tạo thư mục, Org Admin, hoặc người/phòng ban được chia sẻ tường minh (qua modal "Quản lý chia sẻ" mới, menu `⋮` của thư mục) mới thấy được thư mục đó và tài liệu bên trong; mặc định MỌI thư mục vẫn mở cho cả tổ chức như trước (không đổi hành vi dữ liệu cũ). Chia sẻ 1 tệp lẻ (`FileShare`) vẫn hoạt động như "link trực tiếp" tới đúng tệp đó dù thư mục cha đang hạn chế.
- Mỗi file hiển thị nhãn phiên bản (`v3`) kèm link "Xem lịch sử phiên bản" (danh sách `FileVersion`, tối đa N bản gần nhất).
- **(Bổ sung 22/07/2026)** Click trực tiếp vào tên tệp (hoặc mục "Xem tệp" trong menu `⋮`) mở tệp ngay trong tab mới của trình duyệt (`Content-Disposition: inline` — PDF/ảnh/text được trình duyệt tự render, không cần tải về máy trước). Mục "Tải xuống" riêng biệt luôn ép hộp thoại Lưu tệp (`Content-Disposition: attachment`).

## 6. Module Thông báo

```
Dropdown từ Topbar (🔔):
┌───────────────────────────────┐
│ Thông báo               [Đánh dấu đã đọc tất cả] │
├───────────────────────────────┤
│ ● Bạn được giao "Task X"   2 phút trước │
│ ● "Báo cáo Q3" đã được chia sẻ với bạn  │
│ ○ Dự án "Website SME" đạt 68% tiến độ   │
├───────────────────────────────┤
│           [Xem tất cả thông báo →]      │
└───────────────────────────────┘
```

- Chấm `●` = chưa đọc, `○` = đã đọc.
- Trang "Xem tất cả thông báo" là danh sách đầy đủ có phân trang + filter theo loại (Task/Document/Hệ thống).
- Kênh cập nhật: kết nối WebSocket riêng tới Notification Service ngay sau khi đăng nhập; badge số lượng chưa đọc tăng tức thời khi có event mới, không cần refresh.

## 7. Trang Báo cáo & Phân tích (Analytics chi tiết)

```
┌──────────────────────────────────────────────────────────────┐
│ Báo cáo & Phân tích                                          │
│ [Khoảng thời gian: 01/07 - 18/07 ▾]                [Xuất báo cáo] │
├──────────────────────────────────────────────────────────────┤
│  Tiến độ theo dự án (so sánh)              [Bar chart ngang]  │
│  Website SME        ▓▓▓▓▓▓▓░░░ 68%                            │
│  CRM nội bộ          ▓▓░░░░░░░░ 20%                            │
├──────────────────────────────────────────────────────────────┤
│  Xu hướng hoạt động tài liệu theo ngày      [Area chart]       │
├───────────────────────────────┬──────────────────────────────┤
│ Bảng chi tiết KPI theo dự án (sortable, phân trang)             │
│ Dự án | Task hoàn thành | Tổng task | Tỷ lệ hoàn thành          │
└───────────────────────────────┴──────────────────────────────┘
```

- Khác với Dashboard (mục 3 — tổng quan, real-time), trang này phục vụ **phân tích sâu, có bộ lọc thời gian tùy chỉnh**. **(Sửa 28/07/2026, chính xác lại mô tả)** "Tiến độ theo dự án"/bảng chi tiết đọc trực tiếp từ `fact_task_events` (không phải continuous aggregate như mô tả trước đây — đã cần chuyển sang đọc trực tiếp từ 22/07/2026 để loại trừ được task/dự án đã xóa cứng, xem Technical_Spec.md §4.6/§14); chỉ riêng "Xu hướng hoàn thành công việc theo tuần" ở Dashboard (mục 3) mới thực sự dùng continuous aggregate (`daily_task_summary`).
- "Xuất báo cáo" xuất CSV/PDF từ bảng chi tiết (nếu còn thời gian triển khai — không thuộc tiêu chí bắt buộc của MVP).
- **(Điều chỉnh 21/07/2026, bổ sung lại 28/07/2026)** Bộ lọc "Phòng ban" từng bị gỡ (cùng lý do ở mục 3) nay quay lại đúng cách — áp dụng cho cả "Tiến độ theo dự án" lẫn bảng chi tiết KPI. Bảng chi tiết vẫn giữ "theo dự án" (không đổi lại "theo phòng ban") vì 1 dự án có thể có người phụ trách từ nhiều phòng ban — bộ lọc phòng ban chỉ THU HẸP tập dự án/công việc được tính, không đổi chiều nhóm của bảng.
- **(Bổ sung 28/07/2026 — tính năng "Nhận xét AI", Technical_Spec.md §4.7)** Thẻ mới "Nhận xét AI" ngay dưới thanh bộ lọc, phía trên 2 biểu đồ: nút "Tạo nhận xét AI" (theo yêu cầu, không tự động gọi khi vào trang hay đổi bộ lọc — tránh tốn hạn ngạch miễn phí của Google Gemini API) sinh ra một đoạn văn bản tiếng Việt ngắn (3-5 câu) nhận xét về số liệu KPI đang hiển thị (dựa trên đúng bộ lọc "Khoảng thời gian"/"Phòng ban" tại thời điểm bấm nút), kèm dòng chú thích nhỏ ghi rõ phạm vi/khoảng thời gian đã dùng để tạo ra nhận xét đó.

## 8. Trang Quản trị hệ thống (chỉ Org Admin)

```
┌──────────────────────────────────────────────────────────────┐
│ Quản trị > Thành viên                        [+ Mời thành viên]│
├──────────────────────────────────────────────────────────────┤
│ Tên          | Email              | Phòng ban  | Vai trò | ⋮  │
│ Nguyễn Văn A | a@company.com      | Kinh doanh | Manager | ⋮  │
│ Trần Thị B   | b@company.com      | Kỹ thuật   | Employee| ⋮  │
├──────────────────────────────────────────────────────────────┤
│ Tab phụ: [Thành viên] [Phòng ban] [Vai trò & Phân quyền] [Sự kiện lỗi hệ thống] │
└──────────────────────────────────────────────────────────────┘
```

- Tab **Vai trò & Phân quyền**: ma trận checkbox `Role x Permission` (ví dụ hàng `Manager`, cột `task:create`, `document:delete`...).
- Hành động `⋮` trên mỗi thành viên: Đổi vai trò, Vô hiệu hóa tài khoản (không xóa cứng — soft delete để giữ toàn vẹn dữ liệu lịch sử/audit). **(Bổ sung 22/07/2026)** Với thành viên đang bị vô hiệu hoá, hành động `⋮` đổi thành **"Kích hoạt lại"** — trước bản sửa này, một tài khoản đã vô hiệu hoá không có đường quay lại nào qua giao diện (kể cả khi vô hiệu hoá nhầm); không thể tự vô hiệu hoá chính tài khoản đang đăng nhập (chặn ở tầng API, tránh khoá tổ chức khỏi toàn bộ chức năng quản trị nếu đó là Org Admin duy nhất).
- **(Bổ sung 28/07/2026) Tab "Sự kiện lỗi hệ thống"** — bảng chỉ-đọc liệt kê các sự kiện xử lý nội bộ (Kafka) đã thất bại vĩnh viễn hoặc hết lượt tự động thử lại (Dead Letter Queue — xem Technical_Spec.md mục 4.5): thời điểm, loại lỗi, **phạm vi**, service/topic nguồn, thông báo lỗi. Đây là công cụ chẩn đoán vận hành cho Org Admin, không phải lỗi do người dùng gây ra và không có hành động sửa/xoá nào trên trang này.
- **(Bổ sung 28/07/2026, đợt "ultimate check") Cột "Phạm vi"** — huy hiệu "Tổ chức của bạn" hoặc "Không xác định tổ chức". Cột mới này xuất hiện sau khi phát hiện các sự kiện lỗi `MALFORMED_JSON` (hỏng ngay từ khâu đọc JSON, trước khi xác định được tổ chức nào) trước đó **vô hình hoàn toàn** với mọi Org Admin do bị lọc nhầm theo `organizationId`. Nay các bản ghi này hiển thị cho MỌI Org Admin kèm nhãn "Không xác định tổ chức" (kèm ghi chú giải thích phía trên bảng) — chấp nhận được vì đây là dữ liệu chẩn đoán hạ tầng dùng chung, không phải dữ liệu nghiệp vụ riêng tổ chức nào (xem lý do đầy đủ ở Technical_Spec.md mục 4.5).

## 9. Chấm công & Nghỉ phép (HRM-lite) *(triển khai 05/08/2026, xem Technical_Spec.md §17)*

Bản mô tả này thay thế khung sườn phác thảo trước đó (ghi trước từ 18/07/2026) — cập nhật đúng theo những gì đã lập trình và xác minh sống, theo đúng quy ước của tài liệu này (mô tả thực tế, không phải kế hoạch).

### 9.1 Trang Chấm công

```
┌──────────────────────────────────────────────────────────────┐
│ Chấm công                                                     │
├──────────────────────────────────────────────────────────────┤
│ Hôm nay (05/08/2026)                                          │
│  Đã vào làm lúc 08:15 (Tại văn phòng)        [ Check-out 📷 ] │
├──────────────────────────────────────────────────────────────┤
│ Lịch sử chấm công                                             │
│ Ngày        Vào làm                Ra về                      │
│ 05/08/2026  08:15 (Tại văn phòng)  —                          │
│ 04/08/2026  08:20 (Ngoài văn phòng) 17:05 (Tại văn phòng)     │
├──────────────────────────────────────────────────────────────┤
│ Chấm công toàn tổ chức          ← CHỈ hiện với Manager/Org Admin │
│ Nhân viên   Ngày        Vào làm            Ra về               │
│ An Nguyễn   05/08/2026  08:15 (Văn phòng)  —                   │
└──────────────────────────────────────────────────────────────┘
```

- Bấm "Check-in"/"Check-out" mở **modal camera** (`CheckInCamera.tsx`, mục 9.3) thay vì đi thẳng vào API — bắt buộc chụp 1 ảnh trước khi xác nhận.
- **Không** hiển thị dạng lịch tháng đánh dấu đi trễ/nghỉ như bản phác thảo ban đầu — đơn giản hoá thành bảng danh sách theo ngày (đủ dùng cho phạm vi đồ án, tránh xây thêm logic tính "đi trễ" chưa có yêu cầu rõ ràng).
- 1 ngày chỉ check-in/check-out được 1 lần — nút tương ứng biến mất/đổi trạng thái sau khi đã thực hiện, không cho bấm lại (máy chủ cũng từ chối nếu cố gọi API trực tiếp).
- **(Bổ sung 13/08/2026, Technical_Spec.md §17):** nhãn "Tại văn phòng"/"Ngoài văn phòng" là cờ mềm dựa trên GPS — CHỈ hiện khi có dữ liệu để đánh giá (thiếu quyền vị trí/toạ độ văn phòng chưa cấu hình thì không hiện gì, không phải lỗi), KHÔNG chặn check-in/out. Khối "Chấm công toàn tổ chức" là bảng MỚI, cho Manager/Org Admin đối chiếu cờ này của cả tổ chức (ẩn hoàn toàn với Employee thường, cùng cơ chế 403-tự-ẩn với mục "Chờ duyệt" ở 9.2).

### 9.2 Trang Nghỉ phép

```
┌──────────────────────────────────────────────────────────────┐
│ Nghỉ phép                                    [+ Yêu cầu mới]  │
├──────────────────────────────────────────────────────────────┤
│ Chờ duyệt (2)                    ← CHỈ hiện với Manager/Org Admin │
│ 10/08 - 12/08  Việc gia đình         [ Từ chối ]  [ Duyệt ]    │
├──────────────────────────────────────────────────────────────┤
│ Yêu cầu của tôi                                               │
│ 10/08 - 12/08  Việc gia đình              Chờ duyệt            │
│ 01/07 - 03/07  Nghỉ phép năm              Đã duyệt             │
└──────────────────────────────────────────────────────────────┘
```

- Mục "Chờ duyệt" chỉ hiển thị khi gọi API danh sách toàn tổ chức thành công — Employee thường nhận lỗi `403` (thiếu quyền) và mục này tự ẩn đi, KHÔNG hiện banner lỗi (frontend hiện chưa có cơ chế kiểm tra quyền theo permission-key phía client ngoài các trang Quản trị, xem `Doc/Script.md`).
- Duyệt/từ chối xong, yêu cầu biến mất khỏi "Chờ duyệt" và đổi trạng thái ở "Yêu cầu của tôi" (của người xin) gần như tức thời qua thông báo real-time.

### 9.3 Modal camera chấm công (`CheckInCamera.tsx`)

```
┌────────────────────────────────┐
│ Chụp ảnh chấm công              │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │                            │ │
│ │      (xem trước camera)     │ │
│ │                            │ │
│ └────────────────────────────┘ │
│              [ Hủy ]  [ 📷 Chụp ảnh ] │
└────────────────────────────────┘
```

- Xin quyền camera ngay khi mở modal; nếu bị từ chối/không có camera, hiện thông báo rõ ràng kèm nút "Thử lại" thay vì màn hình trắng khó hiểu.
- Sau khi chụp, hiện lại ảnh vừa chụp với 2 lựa chọn "Chụp lại" hoặc "Xác nhận" — xác nhận mới thực sự gửi lên máy chủ.
- Camera tự tắt (dừng toàn bộ track) ngay khi đóng modal ở bất kỳ bước nào — không để đèn báo camera bật treo.
- **Chỉ chụp ảnh làm bằng chứng, KHÔNG nhận diện khuôn mặt** — xem lý do đầy đủ tại Technical_Spec.md §17.

## 10. Ghi chú Responsive

| Breakpoint | Hành vi |
|---|---|
| `< 768px` (mobile) | Sidebar ẩn mặc định, mở qua nút hamburger; KPI card xếp dọc 1 cột; bảng Kanban cuộn ngang theo cột |
| `768px – 1023px` (tablet) | Sidebar thu gọn còn icon; KPI card 2 cột |
| `≥ 1024px` (desktop) | Bố cục đầy đủ như mô tả ở các mục trên, KPI card 4 cột |

Toàn bộ bảng dữ liệu (danh sách dự án, tài liệu, thành viên) chuyển sang dạng **card list** trên mobile thay vì bảng ngang để tránh tràn màn hình.

## 11. Hồ sơ cá nhân *(bổ sung 22/07/2026)*

```
┌──────────────────────────────────────────────────────────────┐
│  Hồ sơ cá nhân                                                │
├──────────────────────────────────────────────────────────────┤
│  (Avatar)  Nguyễn Văn A                        [Đang hoạt động]│
│            a@company.com                                      │
│  ──────────────────────────────────────────────────────────── │
│  ✉ Email: a@company.com          🏢 Phòng ban: Kinh doanh     │
│  🛡 Vai trò: Manager               📅 Ngày tham gia: 15/06/2026 │
└──────────────────────────────────────────────────────────────┘
```

- Truy cập qua menu `[Tên user ▾]` ở Topbar (mục 2) → **Hồ sơ cá nhân**.
- Chỉ-đọc trong MVP: hiển thị dữ liệu thật của chính người dùng đang đăng nhập (`GET /users/:id` — IAM Service, mọi thành viên đã xác thực đều tự xem được chính mình, không cần quyền quản trị).
- **Không** thêm field ngoài entity `User` hiện có (Technical_Spec.md §5: `fullName`, `email`, `departmentId`, `roles`, `isActive`, `createdAt`) — chưa có avatar ảnh thật/số điện thoại/tiểu sử trong phạm vi MVP.
- Đổi phòng ban/vai trò vẫn thực hiện ở Quản trị > Thành viên (mục 8, yêu cầu quyền `user:manage`) — trang này không có form chỉnh sửa để tránh trùng lặp logic phân quyền.

## 12. Khách hàng & Cơ hội bán hàng (CRM-lite) *(bổ sung 05/08/2026)*

### 12.1 Danh sách khách hàng

```
┌──────────────────────────────────────────────────────────────┐
│ Khách hàng                              [+ Khách hàng mới]    │
├──────────────────────────────────────────────────────────────┤
│ [Tìm kiếm khách hàng___________]                               │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
│ │ Công ty TNHH ABC │ │ Cửa hàng XYZ     │ │ Công ty Kiến Thiết│ │
│ │ 🏢 ABC Corp      │ │ ✉ xyz@shop.vn    │ │ 🏢 KT Group      │  │
│ │ ────────────────  │ │ ────────────────  │ │ ────────────────  │
│ │ 3 deal · 150tr    │ │ 1 deal · 20tr     │ │ 0 deal · 0đ      │  │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- Click vào thẻ khách hàng → trang chi tiết (mục 12.2). Menu `⋮` trên thẻ có mục "Xoá khách hàng" (xoá cascade toàn bộ deal của khách hàng đó — xác nhận qua hộp thoại).
- Số deal/tổng giá trị hiển thị trên thẻ CHỈ tính deal đang hoạt động (chưa `WON`/`LOST`) — `GET /customers` trả kèm sẵn, không tính lại ở client.

### 12.2 Chi tiết khách hàng — Kanban pipeline bán hàng

```
┌──────────────────────────────────────────────────────────────┐
│ ← Công ty TNHH ABC          🏢 ABC Corp  ✉ contact@abc.vn      │
│                                              [+ Deal mới]      │
├─────────┬───────────┬──────────┬─────────────┬────────┬───────┤
│  Mới (2) │ Đã liên hệ │ Đề xuất  │ Đàm phán (1) │ Thắng  │ Thua  │
├─────────┼───────────┼──────────┼─────────────┼────────┼───────┤
│ [Deal]   │ [Deal]     │           │ [Deal]       │        │        │
│ Gói năm  │ Nâng cấp   │           │ Triển khai   │        │        │
│ 30tr     │ 15tr       │           │ 50tr         │        │        │
└─────────┴───────────┴──────────┴─────────────┴────────┴───────┘
```

- Kéo-thả (drag & drop) thẻ deal giữa các cột → gọi `PATCH /api/v1/deals/:id/stage` → phát sự kiện `deal.stage_changed`. **Khác với Kanban Công việc (mục 4.2, 3 cột tuyến tính):** 4 cột đầu (Mới/Đã liên hệ/Đề xuất/Đàm phán) di chuyển tự do qua lại lẫn nhau (đúng thực tế bán hàng — khách hàng có thể đổi ý, quay lại giai đoạn trước); "Thắng"/"Thua" là cột **cuối cùng** — deal đã vào 1 trong 2 cột này không kéo đi tiếp được nữa (máy chủ từ chối, trả lỗi rõ ràng nếu cố tình gọi API trực tiếp).
- Deal chuyển sang "Thắng" tự động ghi nhận thời điểm chốt (`closedAt`) và gửi 1 thông báo real-time chúc mừng cho người thực hiện thao tác (Module Thông báo, mục 6).
- Click vào thẻ deal mở **Modal chi tiết Deal**: tiêu đề, giá trị, ngày dự kiến chốt, nút Xoá. **Không** có ô đổi giai đoạn trong modal này — đổi giai đoạn chỉ qua kéo-thả, tránh 2 nơi cùng sửa 1 giá trị theo 2 cơ chế khác nhau.

---

## Lịch sử thay đổi tài liệu

- **2026-07-18** — Khởi tạo tài liệu `Wireframe.md`: mô tả wireframe văn bản cho toàn bộ màn hình MVP (Đăng nhập/Đăng ký, App Shell, Dashboard, Dự án & Công việc, Tài liệu, Thông báo, Báo cáo & Phân tích, Quản trị), phác thảo trước màn hình Chấm công (Phase 2), và ghi chú responsive.
- **2026-07-21** — Cập nhật sau đợt code review toàn diện: bỏ bộ lọc "Phòng ban" khỏi danh sách dự án (mục 4.1) và trang Báo cáo & Phân tích (mục 7, đổi bảng chi tiết từ "theo phòng ban" sang "theo dự án"); làm rõ Modal Chia sẻ tài liệu (mục 5) trong MVP chỉ mang tính hiển thị, chưa phải access-control thực sự. Lý do: `Project`/`Task` không lưu `departmentId`, và `FileShare` hiện chưa được service enforce như quyền truy cập — xem Technical_Spec.md §14 để biết chi tiết và hướng phát triển.
- **2026-07-22** — Bổ sung sau phản hồi kiểm thử thực tế của người dùng trên bản build đã sửa lỗi ngày 22/07/2026 (xem Technical_Spec.md để biết chi tiết kỹ thuật đầy đủ):
  - Mục 2 (App Shell): ô tìm kiếm Topbar từ chỗ chỉ là placeholder tĩnh ("sắp ra mắt") trở thành tìm kiếm tổng hợp thật (client-side, theo Dự án/Công việc/Thành viên/Thư mục); menu `[Tên user ▾]` mở thêm mục "Hồ sơ cá nhân" (trước đó bị khoá/không làm gì).
  - Mục 5 (Tài liệu): bổ sung khả năng mở/xem tệp trực tiếp trong tab trình duyệt (click tên tệp hoặc mục "Xem tệp"), tách biệt với "Tải xuống" (luôn ép lưu file).
  - Mục 11 (mới): trang Hồ sơ cá nhân — hiển thị dữ liệu thật của người dùng đang đăng nhập, không bịa field mới ngoài entity `User` đã đặc tả.
- **2026-07-22 (review toàn dự án)** — Sau đợt walkthrough toàn bộ dự án theo vai trò giảng viên phản biện (ClaudeRule.md mục 6) và sửa lỗi theo mức độ nghiêm trọng (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục review 22/07/2026), phần thay đổi có ảnh hưởng trực tiếp tới UI:
  - Mục 8 (Quản trị > Thành viên): hành động `⋮` bổ sung "Kích hoạt lại" cho tài khoản đã bị vô hiệu hoá (trước đó không có đường quay lại nào qua giao diện).
  - Không có màn hình/luồng UI mới nào khác phát sinh từ đợt review này — phần lớn phát hiện và sửa lỗi nằm ở tầng backend (RBAC, race condition, xác thực, xử lý dữ liệu) hoặc là sửa lại đúng hành vi đã đặc tả (ví dụ: mở tệp trực tiếp không còn im lặng bị chặn bởi popup blocker) thay vì thay đổi giao diện.
- **2026-07-25 (review vòng 2)** — Đợt walkthrough lần 2 theo cùng quy trình (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục review 25/07/2026). Thay đổi có ảnh hưởng trực tiếp tới UI:
  - **Mục 10 (Ghi chú Responsive):** hành vi "Sidebar thu gọn còn icon" ở breakpoint tablet (`768px–1023px`) đã có trong đặc tả từ 18/07/2026 nhưng CHƯA từng được lập trình (hạ tầng state đã có sẵn nhưng không nơi nào gọi tới) — phát hiện qua đợt review này, nay đã lập trình đúng đặc tả: tự thu gọn khi vào khoảng tablet, tự mở lại khi ra khỏi khoảng đó, TRỪ khi người dùng đã tự tay bật/tắt sidebar thủ công (giữ nguyên lựa chọn của người dùng, không tự ý ghi đè).
  - Thông báo lỗi validate dữ liệu đầu vào (vd nhập sai định dạng email, mật khẩu quá ngắn ở form Mời thành viên/Đăng ký tổ chức) trước đó hiện bằng tiếng Anh — nay hiện bằng tiếng Việt, đúng ClaudeRule.md mục 1 (không phát sinh màn hình/luồng mới, chỉ đổi nội dung thông báo lỗi đã có).
  - Không có màn hình/luồng UI mới nào khác — phần lớn phát hiện của đợt này (leo thang đặc quyền RBAC, nguy cơ sập tiến trình Gateway, sai lệch KPI, hạ tầng Docker/seed script) đều thuộc tầng backend, không đổi giao diện.
- **2026-07-28 (nâng cấp chất lượng Frontend)** — Đợt nâng cấp đầu tiên trong loạt nâng cấp đã lên kế hoạch (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục 2026-07-28). Không có màn hình/bố cục mới nào — thay đổi chủ yếu là chia nhỏ bundle theo route (không ảnh hưởng giao diện), bộ kiểm thử E2E mới, và khả năng tiếp cận (a11y): mọi modal/dialog trong ứng dụng giờ quản lý focus đúng chuẩn (focus vào bên trong khi mở, "nhốt" Tab trong dialog, trả focus khi đóng — không thấy được bằng mắt nhưng thay đổi hành vi thao tác bằng bàn phím), thêm liên kết "Bỏ qua tới nội dung chính" (ẩn, chỉ hiện khi Tab tới), và một loạt `aria-label` cho các control trước đó chỉ nhận diện được bằng mắt (ma trận phân quyền, tìm kiếm, avatar người phụ trách...).
- **2026-07-28 (Dead Letter Queue)** — Hạng mục thứ 2 trong loạt nâng cấp (chi tiết kỹ thuật ở Technical_Spec.md mục 4.5). Duy nhất 1 thay đổi UI-visible: mục 8 (Quản trị hệ thống) có thêm tab "Sự kiện lỗi hệ thống".
- **2026-07-28 (Access-control tài liệu theo thư mục)** — Hạng mục thứ 3 (chi tiết kỹ thuật ở Technical_Spec.md, mục cùng tên). Mục 5 (Tài liệu) cập nhật: biểu tượng khoá cho thư mục "Hạn chế truy cập", menu `⋮` của thư mục có thêm "Hạn chế truy cập"/"Mở cho cả tổ chức" và "Quản lý chia sẻ" (chỉ hiện với người tạo thư mục/Org Admin), modal chia sẻ (cả thư mục lẫn tệp) có thêm lựa chọn chia sẻ theo Phòng ban bên cạnh Người dùng.
- **2026-07-28 (KPI theo phòng ban)** — Hạng mục thứ 4 và cuối cùng trước tính năng AI (chi tiết kỹ thuật ở Technical_Spec.md §4.6). Mục 3 (Dashboard) và mục 7 (Báo cáo & Phân tích) đều có lại bộ lọc "Phòng ban" (từng bị gỡ 21/07/2026) — không áp dụng cho biểu đồ xu hướng theo tuần (giới hạn kỹ thuật). Nhân tiện sửa lại mô tả sai lệch ở mục 7 (nguồn dữ liệu thực tế là `fact_task_events`, không phải continuous aggregate như bản mô tả cũ).
- **2026-07-28 (Kiểm tra tổng thể hệ thống — "ultimate check")** — Trước khi bắt đầu tính năng AI, thực hiện kiểm tra toàn diện toàn hệ thống (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục cùng ngày). Duy nhất 1 thay đổi UI-visible: mục 8 (Quản trị hệ thống) — tab "Sự kiện lỗi hệ thống" có thêm cột "Phạm vi" (xem mục 8 ở trên) sau khi phát hiện một nhóm lỗi DLQ trước đó vô hình hoàn toàn với giao diện.
- **2026-07-28 (Nhận xét AI)** — Hạng mục đầu tiên của loạt nâng cấp tính năng AI (chi tiết kỹ thuật ở Technical_Spec.md §4.7). Mục 7 (Báo cáo & Phân tích) có thêm thẻ "Nhận xét AI" với nút bấm theo yêu cầu (không tự động) — xem mục 7 ở trên. Không có màn hình/luồng UI mới nào khác.
- **2026-08-05 (CRM-lite)** — Hạng mục thứ hai trong 2 hạng mục mở rộng còn lại sau khi dự án chuyển sang mô hình 3 người (chi tiết kỹ thuật ở Technical_Spec.md §16). Mục 12 (mới): danh sách khách hàng + Kanban pipeline bán hàng 6 giai đoạn cho từng khách hàng — khác Kanban Công việc (mục 4.2) ở chỗ 4 giai đoạn đầu di chuyển tự do qua lại lẫn nhau, chỉ "Thắng"/"Thua" là trạng thái cuối.
- **2026-08-05 (HRM-lite, tiếp)** — Hạng mục cuối cùng trong danh sách mở rộng đã thống nhất ban đầu (chi tiết kỹ thuật ở Technical_Spec.md §17). Mục 9 viết lại hoàn toàn (thay thế khung sườn phác thảo từ 18/07/2026) để khớp đúng những gì đã lập trình: bỏ dạng lịch tháng đánh dấu đi trễ/nghỉ (đơn giản hoá thành bảng danh sách), thêm mục 9.3 mô tả modal camera chấm công — component camera đầu tiên của dự án, chỉ chụp ảnh làm bằng chứng, không nhận diện khuôn mặt (xem Technical_Spec.md §17).
- **2026-08-13 (cờ vị trí chấm công)** — Mục 9.1 cập nhật: nhãn "Tại văn phòng"/"Ngoài văn phòng" (cờ mềm dựa trên GPS, không chặn check-in/out) trên khối "Hôm nay"/"Lịch sử chấm công", cộng thêm khối bảng mới "Chấm công toàn tổ chức" chỉ hiện với Manager/Org Admin (cùng cơ chế 403-tự-ẩn với "Chờ duyệt" ở mục 9.2). Chi tiết kỹ thuật đầy đủ ở Technical_Spec.md §17 (mục bổ sung 13/08/2026).
- **2026-08-20 (sửa 4 báo cáo lỗi thủ công)** — Mục 1 cập nhật: ô mật khẩu có nút hiện/ẩn tự vẽ (thay cho nút có sẵn của trình duyệt, từng mất đồng bộ) và cảnh báo (không chặn) khi phát hiện dấu tiếng Việt gõ nhầm vào mật khẩu. Không có màn hình/luồng UI mới nào khác — 2 báo cáo còn lại đã sửa (dữ liệu thành viên/tài liệu của tổ chức cũ còn sót lại sau khi đổi tài khoản, modal mất focus khi gõ) là lỗi hành vi/cache, không đổi bố cục hay thêm phần tử giao diện nào. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md`, mục cùng ngày.
- **2026-08-20 → 21 (Đa ngôn ngữ Việt/Anh/Nhật)** — Mục 0 và mục 2 cập nhật: nút chọn ngôn ngữ (🌐) mới ở góc trên-phải màn Đăng nhập/Đăng ký (mục 1) và trên Topbar mọi trang đã đăng nhập (mục 2), đổi được giữa Tiếng Việt (mặc định)/English/日本語, lựa chọn được ghi nhớ. Áp dụng cho TOÀN BỘ màn hình đã mô tả trong tài liệu này — không liệt kê lại từng mục vì không đổi bố cục/thêm phần tử nào khác ngoài việc mọi nhãn/nút/thông báo đều có bản dịch. Chi tiết kỹ thuật đầy đủ (kiến trúc i18next, danh mục mã lỗi backend, 2 lỗi thật phát hiện qua xác minh trực tiếp) ở `Technical_Spec.md` §18.
