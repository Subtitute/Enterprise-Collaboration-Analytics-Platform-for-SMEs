# Wireframe — Enterprise Collaboration & Analytics Platform for SMEs

> Trạng thái: **ĐÃ TRIỂN KHAI** — mô tả wireframe khớp với giao diện đã lập trình và xác minh sống
> cho toàn bộ màn hình MVP và các module mở rộng (CRM-lite, HRM-lite, i18n, Analytics nâng cao,
> Kho hàng, Nhận diện khuôn mặt, Chatbot nội bộ — 24/10/2026).
> Chi tiết lịch sử đầy đủ: xem `RevisionHistory.md`.

**Tài liệu liên quan:** [General_idea.md](General_idea.md) · [Technical_Spec.md](Technical_Spec.md)
**Ngày khởi tạo:** 18/07/2026
**Mức độ:** Low-fidelity (wireframe văn bản/ASCII) — mô tả bố cục và luồng, chưa phải thiết kế UI cuối cùng.

---

## 0. Quy ước chung

- **Ngôn ngữ giao diện:** Tiếng Việt mặc định; thuật ngữ kỹ thuật/tên riêng (Dashboard, Kanban, Task, Upload...) giữ nguyên tiếng Anh khi đã quen dùng trong ngành. **(Bổ sung 20-21/08/2026)** Người dùng có thể đổi sang English/日本語 bất kỳ lúc nào qua nút chọn ngôn ngữ (icon địa cầu 🌐) — góc trên-phải màn Đăng nhập/Đăng ký (§1), cạnh chuông thông báo trên Topbar ở mọi trang đã đăng nhập (§2). Lựa chọn được ghi nhớ cho lần mở lại sau. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §18.
- **Component base:** shadcn/ui (dựa trên Radix + TailwindCSS) — dùng chung bộ Button/Input/Modal/Table/Toast xuyên suốt để đảm bảo nhất quán.
- **Bố cục khung (shell):** Sidebar trái cố định + Topbar trên + vùng nội dung chính — áp dụng cho mọi trang sau khi đăng nhập.
- **Thời gian hiển thị:** toàn bộ mốc thời gian hiển thị theo GMT+7, định dạng `dd/MM/yyyy HH:mm`.
- **Trạng thái tải dữ liệu:** mọi bảng/danh sách đều có 3 trạng thái — loading (skeleton), empty (empty-state kèm CTA), error (thông báo + nút thử lại).
- **Responsive:** breakpoint chính ở `768px` (mobile) và `1024px` (tablet/desktop) — chi tiết ở [§10](#10-ghi-chú-responsive).

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
- **(Bổ sung 20/08/2026)** Ô mật khẩu có nút hiện/ẩn riêng của ứng dụng (icon con mắt) — tự vẽ bằng React thay vì dựa vào nút "reveal password" có sẵn của trình duyệt (từng mất đồng bộ với state, xem `Technical_Spec.md` mục 20/08/2026). Nếu phát hiện dấu tiếng Việt trong mật khẩu đang gõ (thường do bộ gõ tự động ghép dấu ngoài ý muốn), hiện 1 dòng cảnh báo nhỏ ngay dưới ô — chỉ cảnh báo, không chặn ký tự.
- **(Bổ sung 20-21/08/2026)** Nút chọn ngôn ngữ (🌐) cố định ở góc trên-phải màn hình này — xem §0.

## 2. Khung bố cục tổng thể (App Shell) *(sửa lại 03/10/2026, xem Technical_Spec.md §21.1)*

```
┌───┬──────────┬──────────────────────────────────────────────┐
│   │          │  Topbar: [🔍 Tìm kiếm]  [🌐] [🔔 3] [User ▾]  │
│ ▣ │ Tổng quan├──────────────────────────────────────────────┤
│Trang│ Dự án   │                                              │
│chủ│và CV      │                                              │
│ ▣ │ Tài liệu  │          Vùng nội dung chính                 │
│Chấm│ Khách    │          (thay đổi theo route)                │
│công│hàng      │                                              │
│ ▣ │          │                                              │
│Nghỉ│ (sidebar │                                              │
│phép│ phụ, chỉ │                                              │
│ ▣ │ hiện khi │                                              │
│Nhắn│ Trang chủ│                                              │
│tin │ đang active)                                            │
│ ▣ │          │                                              │
│Báo │          │                                              │
│cáo │          │                                              │
│ ─  │          │                                              │
│ ▣ │          │                                              │
│Quản│          │                                              │
│trị │          │                                              │
└───┴──────────┴──────────────────────────────────────────────┘
```

- **Sidebar chính** luôn ở dạng dải icon thu gọn, **chỉ mở rộng ra thành label khi con trỏ chuột di vào** (overlay, không đẩy lệch nội dung trang) — thay cho nút thu/phóng thủ công trước đây. Thứ tự: Trang chủ → Chấm công → Nghỉ phép → Nhắn tin → Báo cáo & Phân tích → Quản trị (chỉ Org Admin/Manager tuỳ mục).
- **Trang chủ** gộp Dự án & Công việc / Tài liệu / Khách hàng (trước đây là 3 mục ngang hàng riêng biệt): bấm vào mở thêm 1 **sidebar phụ cố định** (không phải flyout, luôn hiện khi đang ở 1 trong 4 route này) liệt kê Tổng quan (Dashboard cũ)/Dự án và công việc/Tài liệu/Khách hàng — route của từng trang giữ nguyên hoàn toàn, đây chỉ là thay đổi cách trình bày điều hướng.
- **Không còn mục "Thông báo" riêng trên sidebar** — xem §6, toàn bộ chức năng nay nằm trong dropdown chuông (🔔) ở Topbar.
- Chuông thông báo (🔔) hiển thị badge số lượng chưa đọc, cập nhật real-time qua WebSocket không cần reload.
- **[Tên user ▾]** mở menu: **Hồ sơ cá nhân** (§11) và **Đăng xuất**.
- **(Bổ sung 20-21/08/2026)** Icon **[🌐]** mở nút chọn ngôn ngữ (Tiếng Việt/English/日本語) — xem §0.
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
- Feed "Hoạt động gần đây" là danh sách event thô gần nhất (giới hạn 20 item), khác với Notification cá nhân (§6).
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

## 6. Module Thông báo *(sửa lại 03/10/2026 — xoá trang riêng, xem Technical_Spec.md §21.2)*

```
Dropdown từ Topbar (🔔) — nay là giao diện thông báo DUY NHẤT:
┌───────────────────────────────┐
│ Thông báo               [Đánh dấu đã đọc tất cả] │
├───────────────────────────────┤
│ ● Bạn được giao "Task X"   2 phút trước │
│ ● "Báo cáo Q3" đã được chia sẻ với bạn  │
│ ○ Dự án "Website SME" đạt 68% tiến độ   │
│   (bấm vào không có link → mở rộng ngay │
│   tại chỗ xem toàn văn)                  │
├───────────────────────────────┤
│           [Tải thêm thông báo]           │
└───────────────────────────────┘
```

- Chấm `●` = chưa đọc, `○` = đã đọc. Danh sách hiện CẢ đã đọc lẫn chưa đọc (trước đây dropdown chỉ hiện 6 tin chưa đọc gần nhất), mới nhất trước.
- **Không còn trang "Xem tất cả thông báo" riêng** — dropdown tự phân trang bằng nút "Tải thêm", thay thế hoàn toàn chức năng của trang cũ. Cố ý bỏ bộ lọc theo loại thông báo để giữ dropdown gọn.
- Bấm vào 1 thông báo: đánh dấu đã đọc ngay (cập nhật badge), rồi nếu có link đính kèm thì điều hướng tới đó (không tải lại trang); nếu không có link thì mở rộng ngay tại chỗ để xem toàn văn.
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

- Khác với Dashboard (§3 — tổng quan, real-time), trang này phục vụ **phân tích sâu, có bộ lọc thời gian tùy chỉnh**. **(Sửa 28/07/2026, chính xác lại mô tả)** "Tiến độ theo dự án"/bảng chi tiết đọc trực tiếp từ `fact_task_events` (không phải continuous aggregate như mô tả trước đây — đã cần chuyển sang đọc trực tiếp từ 22/07/2026 để loại trừ được task/dự án đã xóa cứng, xem Technical_Spec.md §4.6/§14); chỉ riêng "Xu hướng hoàn thành công việc theo tuần" ở Dashboard (§3) mới thực sự dùng continuous aggregate (`daily_task_summary`).
- "Xuất báo cáo" xuất CSV/PDF từ bảng chi tiết (nếu còn thời gian triển khai — không thuộc tiêu chí bắt buộc của MVP).
- **(Điều chỉnh 21/07/2026, bổ sung lại 28/07/2026)** Bộ lọc "Phòng ban" từng bị gỡ (cùng lý do ở §3) nay quay lại đúng cách — áp dụng cho cả "Tiến độ theo dự án" lẫn bảng chi tiết KPI. Bảng chi tiết vẫn giữ "theo dự án" (không đổi lại "theo phòng ban") vì 1 dự án có thể có người phụ trách từ nhiều phòng ban — bộ lọc phòng ban chỉ THU HẸP tập dự án/công việc được tính, không đổi chiều nhóm của bảng.
- **(Bổ sung 28/07/2026 — tính năng "Nhận xét AI", Technical_Spec.md §4.7)** Thẻ mới "Nhận xét AI" ngay dưới thanh bộ lọc, phía trên 2 biểu đồ: nút "Tạo nhận xét AI" (theo yêu cầu, không tự động gọi khi vào trang hay đổi bộ lọc — tránh tốn hạn ngạch miễn phí của Google Gemini API) sinh ra một đoạn văn bản tiếng Việt ngắn (3-5 câu) nhận xét về số liệu KPI đang hiển thị (dựa trên đúng bộ lọc "Khoảng thời gian"/"Phòng ban" tại thời điểm bấm nút), kèm dòng chú thích nhỏ ghi rõ phạm vi/khoảng thời gian đã dùng để tạo ra nhận xét đó.
- **(Bổ sung 22/09/2026, thiết kế lại)** "Nhận xét AI" không còn là 1 đoạn văn tự do — nay là bộ thẻ insight CÓ CẤU TRÚC (severity/scope/số liệu riêng biệt, xem Technical_Spec.md §4.7 phiên bản mới) kèm 1 biểu đồ cột ngang so sánh TOÀN BỘ phạm vi đã quét (toàn tổ chức + từng phòng ban + top dự án), chỉ các mục được AI chọn mới tô màu theo mức độ (đỏ/cam/xanh), còn lại tô xám trung tính làm nền so sánh.
- **(Bổ sung 24/09/2026 — Layer 2 Diagnostic drill-down, Technical_Spec.md §19.2)** Mỗi thanh trong biểu đồ so sánh ở trên (trừ thanh "Toàn tổ chức") có thể bấm vào — mở 1 panel chi tiết hiển thị phễu "Tổng công việc → Chưa xong → Quá hạn → Tập trung ở 1 người" cho đúng phòng ban/dự án đó, giúp trả lời "vì sao" thay vì chỉ dừng ở con số tổng hợp. Panel ghi rõ ghi chú giới hạn: "quá hạn" tính theo hạn hoàn thành tại thời điểm tạo công việc, có thể chưa cập nhật nếu hạn được đổi sau đó.
- **(Bổ sung 24/09/2026 — Layer 3 Anomaly Detection, Technical_Spec.md §19.3)** Khối mới "Phát hiện bất thường" dưới khối "Nhận xét AI" — nút "Chạy phát hiện bất thường" (theo yêu cầu, không tự động) quét toàn bộ nhân viên trong phạm vi (Org Admin: toàn tổ chức; Manager: phòng ban mình phụ trách) bằng mô hình Isolation Forest thật, hiển thị thẻ nhân viên bị gắn cờ kèm chỉ số lệch nhiều nhất so với trung bình đội nhóm (vd "Tỷ lệ chấm công 58% ↓ so với trung bình đội nhóm 93"). Khối này chỉ hiện với người có quyền `ml:view` (Org Admin/Manager theo mặc định).
- **(Bổ sung 24/09/2026 — Layer 5 Recommendation Engine, Technical_Spec.md §19.4)** Nếu đã chạy "Phát hiện bất thường" trước đó, lần bấm "Tạo nhận xét AI" tiếp theo sẽ gửi kèm kết quả đó cho AI — các thẻ insight liên quan có thêm khối "Kế hoạch hành động" (huy hiệu mức ưu tiên Cao/Vừa/Thấp, kèm hành động cụ thể/lý do/tác động kỳ vọng/mức công sức ước tính), hiển thị ngay dưới khối gợi ý đã có.
- **(Bổ sung 16/10/2026 — xu hướng thị trường sản phẩm, Technical_Spec.md §22.3)** 2 biểu đồ mới ở cuối trang, dưới khối "Phát hiện bất thường": **"Xu hướng doanh số theo sản phẩm"** (area/line chart, chọn được khung 7 hoặc 30 ngày gần nhất — không có mốc quý vì dữ liệu mua hàng demo chưa đủ dài) và **"Top sản phẩm bán nhiều nhất"** (bar chart ngang, xếp hạng theo tổng số lượng đã bán trong khung thời gian đang chọn). Cả 2 đọc từ hypertable `fact_product_sales` mới, dữ liệu nguồn là các lượt "Ghi nhận mua hàng" ở §12.2 — không có bộ lọc "Phòng ban" (dữ liệu bán hàng không gắn với phòng ban nào).

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

- **(Bổ sung 24/09/2026 — nhập hàng loạt qua Excel, Technical_Spec.md §19.1)** Tab **Thành viên** có thêm nút "Nhập từ Excel" cạnh nút "Mời thành viên" — tải file mẫu `.xlsx` (cột Họ và tên/Email/Mật khẩu/Phòng ban/Vai trò), điền rồi chọn lại file để xem trước (phân biệt dòng hợp lệ/lỗi kèm lý do) trước khi nhập hàng loạt. Không đổi backend — mỗi dòng hợp lệ gọi tuần tự cùng 1 API mời thành viên đã có.
- Tab **Vai trò & Phân quyền**: ma trận checkbox `Role x Permission` (ví dụ hàng `Manager`, cột `task:create`, `document:delete`...).
- Hành động `⋮` trên mỗi thành viên: Đổi vai trò, Vô hiệu hóa tài khoản (không xóa cứng — soft delete để giữ toàn vẹn dữ liệu lịch sử/audit). **(Bổ sung 22/07/2026)** Với thành viên đang bị vô hiệu hoá, hành động `⋮` đổi thành **"Kích hoạt lại"** — trước bản sửa này, một tài khoản đã vô hiệu hoá không có đường quay lại nào qua giao diện (kể cả khi vô hiệu hoá nhầm); không thể tự vô hiệu hoá chính tài khoản đang đăng nhập (chặn ở tầng API, tránh khoá tổ chức khỏi toàn bộ chức năng quản trị nếu đó là Org Admin duy nhất).
- **(Bổ sung 25/09/2026 — xoá vĩnh viễn, Technical_Spec.md §19.6)** Với thành viên đang bị vô hiệu hoá, hành động `⋮` có thêm mục **"Xoá vĩnh viễn"** (kèm `ConfirmDialog` cảnh báo riêng, không thể hoàn tác) — `User` từng là entity duy nhất trong dự án chưa có đường xoá cứng nào, khiến tài khoản rác (vd do kiểm thử tự động tạo ra) hiển thị vĩnh viễn dù đã vô hiệu hoá. Chỉ áp dụng được cho tài khoản ĐÃ vô hiệu hoá (chặn ở tầng API) — khác "Vô hiệu hoá" (có thể kích hoạt lại), đây là thao tác một chiều.
- **(Bổ sung 28/07/2026) Tab "Sự kiện lỗi hệ thống"** — bảng chỉ-đọc liệt kê các sự kiện xử lý nội bộ (Kafka) đã thất bại vĩnh viễn hoặc hết lượt tự động thử lại (Dead Letter Queue — xem Technical_Spec.md §4.5): thời điểm, loại lỗi, **phạm vi**, service/topic nguồn, thông báo lỗi. Đây là công cụ chẩn đoán vận hành cho Org Admin, không phải lỗi do người dùng gây ra và không có hành động sửa/xoá nào trên trang này.
- **(Bổ sung 28/07/2026, đợt "ultimate check") Cột "Phạm vi"** — huy hiệu "Tổ chức của bạn" hoặc "Không xác định tổ chức". Cột mới này xuất hiện sau khi phát hiện các sự kiện lỗi `MALFORMED_JSON` (hỏng ngay từ khâu đọc JSON, trước khi xác định được tổ chức nào) trước đó **vô hình hoàn toàn** với mọi Org Admin do bị lọc nhầm theo `organizationId`. Nay các bản ghi này hiển thị cho MỌI Org Admin kèm nhãn "Không xác định tổ chức" (kèm ghi chú giải thích phía trên bảng) — chấp nhận được vì đây là dữ liệu chẩn đoán hạ tầng dùng chung, không phải dữ liệu nghiệp vụ riêng tổ chức nào (xem lý do đầy đủ ở Technical_Spec.md §4.5).

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

- Bấm "Check-in"/"Check-out" mở **modal camera** (`CheckInCamera.tsx`, §9.3) thay vì đi thẳng vào API — bắt buộc chụp 1 ảnh trước khi xác nhận.
- **Không** hiển thị dạng lịch tháng đánh dấu đi trễ/nghỉ như bản phác thảo ban đầu — đơn giản hoá thành bảng danh sách theo ngày (đủ dùng cho phạm vi đồ án, tránh xây thêm logic tính "đi trễ" chưa có yêu cầu rõ ràng).
- 1 ngày chỉ check-in/check-out được 1 lần — nút tương ứng biến mất/đổi trạng thái sau khi đã thực hiện, không cho bấm lại (máy chủ cũng từ chối nếu cố gọi API trực tiếp).
- **(Bổ sung 13/08/2026, Technical_Spec.md §17):** nhãn "Tại văn phòng"/"Ngoài văn phòng" là cờ mềm dựa trên GPS — CHỈ hiện khi có dữ liệu để đánh giá (thiếu quyền vị trí/toạ độ văn phòng chưa cấu hình thì không hiện gì, không phải lỗi), KHÔNG chặn check-in/out. Khối "Chấm công toàn tổ chức" là bảng MỚI, cho Manager/Org Admin đối chiếu cờ này của cả tổ chức (ẩn hoàn toàn với Employee thường, cùng cơ chế 403-tự-ẩn với mục "Chờ duyệt" ở 9.2).
- **(Bổ sung 03/10/2026, Technical_Spec.md §21.3):** mỗi dòng trong "Chấm công toàn tổ chức" nay bấm được, mở trang chi tiết `/attendance/:userId` hiển thị toàn bộ lịch sử chấm công của đúng nhân viên đó (chỉ Manager/Org Admin — Employee thường vẫn chỉ thấy đúng 2 khối đầu, không xem được lịch sử người khác qua bất kỳ cách nào).
- **(Bổ sung 24/10/2026, Technical_Spec.md §24 — đảo ngược có chủ đích quyết định ban đầu "không nhận diện khuôn mặt" của §17):** mọi nơi đã hiện badge "Tại văn phòng"/"Ngoài văn phòng" (today, lịch sử cá nhân, bảng toàn tổ chức, modal xem ảnh) nay thêm badge thứ 2 "Khớp khuôn mặt"/"Không khớp" kèm % độ khớp — cùng mức độ "cờ mềm" y hệt badge GPS: ẩn hoàn toàn nếu chưa đăng ký khuôn mặt (Hồ sơ cá nhân, §11) hoặc không phát hiện được mặt trong ảnh, không bao giờ chặn check-in/out.

### 9.2 Trang Nghỉ phép *(sửa lại 03/10/2026 — gộp Lịch công ty, xem Technical_Spec.md §21.3)*

```
┌──────────────────────────────────────┬─────────────────────────────┐
│  Lịch công ty (60%)                   │  [Xem lịch sử theo nhân viên ▾]│
│ ┌────────────────────────────────┐   │  Số dư phép: còn 8/12 ngày    │
│ │  Th2  Th3  Th4  Th5  Th6  Th7  │   │ ───────────────────────────── │
│ │                [+] (bấm 1 ngày  │   │  Chờ duyệt (2)  ← chỉ Manager/│
│ │   1    2    3    4    5    6   │   │                   Org Admin   │
│ │                 ▓Lễ Quốc khánh  │   │  10/08-12/08 Việc gia đình    │
│ │   ...                           │   │        [ Từ chối ] [ Duyệt ]  │
│ └────────────────────────────────┘   │ ───────────────────────────── │
│                                        │  Yêu cầu của tôi              │
│                                        │  10/08-12/08  Chờ duyệt       │
│                                        │  01/07-03/07  Đã duyệt        │
├────────────────────────────────────────────────────────────────────┤
│                                           [+ Yêu cầu nghỉ phép mới]  │
└──────────────────────────────────────────────────────────────────┘
```

- **Lịch công ty** (trước đây là trang riêng `/admin/calendar`, chỉ Org Admin) nay chiếm 60% bên trái của chính trang Nghỉ phép — **mọi thành viên** xem được và tự tạo được sự kiện thường (`type: EVENT`, màu trung tính); tạo **ngày lễ chính thức** (`type: HOLIDAY`, màu nhấn, ảnh hưởng thật tới chấm công — xem §9.1) chỉ Org Admin/Manager làm được, tuỳ chọn này tự ẩn khỏi form tạo nếu bạn không có quyền. Sửa/xoá 1 sự kiện chỉ hiện nút khi bạn là người tạo, HOẶC bạn có quyền quản lý lịch VÀ cấp bậc của bạn cao hơn cấp bậc của người tạo lúc họ tạo sự kiện đó (Employee < Manager < Org Admin) — vd Employee không sửa/xoá được sự kiện của Manager, nhưng Manager sửa/xoá được sự kiện của Employee và mọi ngày lễ.
- **40% bên phải** giữ nguyên 3 khối cũ (số dư phép / chờ duyệt — chỉ Manager/Org Admin / yêu cầu của tôi), nay xếp chồng dọc thay vì chiếm toàn bộ chiều ngang trang.
- **Xem lịch sử theo nhân viên** (ô tìm-chọn mới, chỉ Manager/Org Admin): chọn 1 nhân viên → mở trang chi tiết lịch sử nghỉ phép đầy đủ của người đó (mọi trạng thái, không chỉ đang chờ duyệt). Tên nhân viên trong mục "Chờ duyệt" cũng bấm được để mở thẳng trang này.
- Mục "Chờ duyệt" vẫn tự ẩn (không hiện banner lỗi) khi API trả `403` cho người không có quyền, giữ nguyên cơ chế cũ.
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

- Truy cập qua menu `[Tên user ▾]` ở Topbar (§2) → **Hồ sơ cá nhân**.
- Chỉ-đọc trong MVP: hiển thị dữ liệu thật của chính người dùng đang đăng nhập (`GET /users/:id` — IAM Service, mọi thành viên đã xác thực đều tự xem được chính mình, không cần quyền quản trị).
- **Không** thêm field ngoài entity `User` hiện có (Technical_Spec.md §5: `fullName`, `email`, `departmentId`, `roles`, `isActive`, `createdAt`) — chưa có avatar ảnh thật/số điện thoại/tiểu sử trong phạm vi MVP.
- Đổi phòng ban/vai trò vẫn thực hiện ở Quản trị > Thành viên (§8, yêu cầu quyền `user:manage`) — trang này không có form chỉnh sửa để tránh trùng lặp logic phân quyền.
- **(Bổ sung 24/10/2026, Technical_Spec.md §24)** Thêm khối "Nhận diện khuôn mặt chấm công": checkbox đồng ý (opt-in bắt buộc tick trước khi đăng ký — dữ liệu sinh trắc học) + nút "Đăng ký khuôn mặt" mở modal camera (tái dùng chính component camera chấm công ở §9.1/§9.3). Sau khi đăng ký: hiện thời điểm đăng ký + nút "Đăng ký lại"/"Xoá đăng ký". Kết quả chỉ ảnh hưởng tới badge tham khảo ở §9.1, không có gì khác đổi trên trang này.

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

- Click vào thẻ khách hàng → trang chi tiết (§12.2). Menu `⋮` trên thẻ có mục "Xoá khách hàng" (xoá cascade toàn bộ deal của khách hàng đó — xác nhận qua hộp thoại).
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

- Kéo-thả (drag & drop) thẻ deal giữa các cột → gọi `PATCH /api/v1/deals/:id/stage` → phát sự kiện `deal.stage_changed`. **Khác với Kanban Công việc (§4.2, 3 cột tuyến tính):** 4 cột đầu (Mới/Đã liên hệ/Đề xuất/Đàm phán) di chuyển tự do qua lại lẫn nhau (đúng thực tế bán hàng — khách hàng có thể đổi ý, quay lại giai đoạn trước); "Thắng"/"Thua" là cột **cuối cùng** — deal đã vào 1 trong 2 cột này không kéo đi tiếp được nữa (máy chủ từ chối, trả lỗi rõ ràng nếu cố tình gọi API trực tiếp).
- Deal chuyển sang "Thắng" tự động ghi nhận thời điểm chốt (`closedAt`) và gửi 1 thông báo real-time chúc mừng cho người thực hiện thao tác (Module Thông báo, §6).
- Click vào thẻ deal mở **Modal chi tiết Deal**: tiêu đề, giá trị, ngày dự kiến chốt, nút Xoá. **Không** có ô đổi giai đoạn trong modal này — đổi giai đoạn chỉ qua kéo-thả, tránh 2 nơi cùng sửa 1 giá trị theo 2 cơ chế khác nhau.
- **(Bổ sung 16/10/2026, xem Technical_Spec.md §22)** Dưới khung Kanban, thêm khối **"Lịch sử mua hàng"**:
  ```
  ├──────────────────────────────────────────────────────────────┤
  │  Lịch sử mua hàng                        [+ Ghi nhận mua hàng]│
  │  Sản phẩm      | Số lượng | Đơn giá    | Thời điểm  | Kho xuất │
  │  Laptop Dell   | 2        | 18.500.000đ| 10/10/2026 | Kho HN   │
  │  RAM 16GB      | 5        | 1.450.000đ | 05/10/2026 | —        │
  └──────────────────────────────────────────────────────────────┘
  ```
  Nút "+ Ghi nhận mua hàng" mở modal chọn sản phẩm (từ danh mục sản phẩm, §14.1) + số lượng + đơn
  giá + kho xuất (tuỳ chọn). Nếu chọn kho, ghi nhận mua hàng đồng thời trừ tồn kho của đúng kho đó
  (atomic trong 1 transaction — xem Technical_Spec.md §22.2); không chọn kho thì chỉ ghi nhận mua
  hàng thuần, không ảnh hưởng tồn kho (vd đơn hàng giao thẳng từ nhà cung cấp, không qua kho công
  ty). Đây chính là cơ chế "gán mặt hàng cho từng khách hàng" phục vụ phân tích xu hướng thị
  trường ở §7. Xoá 1 lượt mua hàng (nếu có gắn kho) hoàn tác đúng số lượng đã trừ.

## 13. Nhắn tin nội bộ *(bổ sung 28/09/2026, xem Technical_Spec.md §20)*

```
Mục điều hướng mới "Nhắn tin" (Sidebar, có badge số tin chưa đọc) → trang 2 cột:
┌──────────────────┬───────────────────────────────────────┐
│ [+ Cuộc trò chuyện mới]                                    │
│ ● Nguyễn Văn A     2 phút trước │  Nguyễn Văn A            │
│   "Chào bạn..."                 │  ┌─────────────────────┐│
│ ○ Nhóm Kinh doanh  1 giờ trước  │  │ Chào bạn, dự án...  ││
│   "Đã gửi báo cáo..."           │  └─────────────────────┘│
│                                  │        ┌───────────────┐│
│                                  │        │ Vâng, em nhận ││
│                                  │        │ được rồi ạ    ││
│                                  │        └───────────────┘│
│                                  ├───────────────────────────┤
│                                  │ [Nhập tin nhắn...]  [Gửi]│
└──────────────────┴───────────────────────────────────────┘
```

- Cột trái: danh sách hội thoại (1:1 và nhóm trộn chung), sắp xếp theo hoạt động gần nhất, chấm
  `●`/`○` = có/không có tin chưa đọc (mirror quy ước §6).
- "Cuộc trò chuyện mới" mở modal 2 tab: **Tin nhắn trực tiếp** (chọn đúng 1 người — nếu đã có hội
  thoại 1:1 với người đó, mở lại hội thoại cũ thay vì tạo mới) và **Nhóm** (chọn nhiều người + đặt
  tên nhóm bắt buộc).
- Cột phải: lịch sử tin nhắn (cũ → mới), ô nhập ở dưới cùng. Với nhóm, nút "Quản lý thành viên"
  chỉ hiện với người đã tạo nhóm hoặc người giữ quyền quản lý nhóm (Org Admin/Manager) — Employee
  bình thường trong nhóm không thấy nút này.
- Cập nhật tức thời qua WebSocket riêng (`/ws/messaging`, mirror §6) — tin nhắn mới, hội thoại mới,
  thay đổi thành viên nhóm đều không cần tải lại trang.
- **`ecap-mobile`:** tab thứ 7 mới "Nhắn tin" — cùng chức năng gửi/nhận 1:1 và nhóm, KHÔNG có màn
  hình quản lý thành viên nhóm (để lại cho web, xem `Doc/ECAP_Mobile.md` §17).
- **(Bổ sung 03/10/2026, Technical_Spec.md §21.4)** Dưới MỖI tin nhắn của CHÍNH người đang đăng
  nhập (không bao giờ hiện cho tin của người khác, kể cả trong nhóm), nếu nội dung tin nhắn chứa
  cụm từ liên quan ngày/giờ (vd "ngày mai", "15/10", "thứ Hai tuần sau", "2h", "14 giờ") sẽ tự
  hiện 1 chip nhỏ **"Hẹn lịch nghỉ"** ngay bên dưới bong bóng chat đó:
  ```
  │ Sếp ơi mai em xin nghỉ nhé, có việc gia đình gấp │
  │                                    [ Hẹn lịch nghỉ ] ← chip mới │
  ```
  Bấm vào mở form rút gọn ngay tại chỗ (ngày điền sẵn theo cụm từ nhận diện được, lý do điền sẵn
  nguyên văn tin nhắn, vẫn sửa được) — gửi đi tạo đúng 1 đơn nghỉ phép thật (API `POST
  /leave-requests` sẵn có), đi qua đúng quy trình duyệt bình thường và xuất hiện trong "Yêu cầu
  của tôi" (§9.2) như mọi đơn khác, không cần rời khỏi màn hình chat. Sau khi gửi thành công, chip
  đổi thành trạng thái đã xác nhận (trong phiên hiện tại) để tránh gửi trùng do bấm nhầm lần 2.
  Nhận diện bằng quy tắc/regex thuần (không phải mô hình học máy), nên có thể bỏ sót cách diễn đạt
  lạ hoặc nhận nhầm một vài từ trùng ngẫu nhiên (vd tên riêng "Mai") — chấp nhận được vì đây chỉ là
  một gợi ý tiện lợi, không bắt buộc phải dùng.

## 14. Danh mục sản phẩm & Kho hàng *(bổ sung 16/10/2026, xem Technical_Spec.md §22)*

Mục điều hướng mới "Sản phẩm"/"Kho" (nhóm "Trang chủ", §2) → 2 trang riêng.

### 14.1 Danh mục sản phẩm (`/products`)

```
┌──────────────────────────────────────────────────────────────┐
│ Danh mục sản phẩm              [Quản lý danh mục] [+ Sản phẩm mới] │
├──────────────────────────────────────────────────────────────┤
│ [Tìm kiếm sản phẩm______] [Danh mục: Tất cả ▾]                 │
├──────────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│ │ (ảnh WebP)│ │ (ảnh WebP)│ │ (ảnh WebP)│ │ (ảnh WebP)│       │
│ │ Laptop Dell│ │ RAM 16GB  │ │ Chuột Gaming│ │ SSD 1TB   │       │
│ │ SKU-00142  │ │ SKU-00088  │ │ SKU-00231  │ │ SKU-00067  │       │
│ │ 18.500.000đ│ │ 1.450.000đ │ │ 650.000đ   │ │ 2.100.000đ │       │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
├──────────────────────────────────────────────────────────────┤
│                                    [ ← Trước  1/3  Sau → ]     │
└──────────────────────────────────────────────────────────────┘
```

- Lưới thẻ sản phẩm (2 cột mobile, lên tới 4 cột desktop), mỗi thẻ hiện ảnh (nếu đã tải lên —
  thiếu ảnh thì hiện icon hộp mặc định, không hỏng layout), tên, SKU, đơn giá (định dạng VND), và
  menu `⋮` (Sửa/Xoá — chỉ hiện với người có quyền `product:manage`).
- Tìm kiếm theo tên/SKU lọc phía client (không phân biệt dấu tiếng Việt, debounce 300ms — mirror
  §12.1); lọc theo danh mục gửi lên server. Xoá bộ lọc/đổi trang tự dồn về trang hợp lệ cuối cùng
  nếu trang hiện tại trống sau khi lọc.
- Nút "Quản lý danh mục" mở modal riêng (danh sách danh mục, tạo/sửa/xoá — xoá bị chặn nếu danh
  mục còn sản phẩm, thông báo lỗi rõ ràng chứ không phải lỗi 500 chung).
- Modal "Sản phẩm mới"/"Sửa sản phẩm": tên, SKU (không trùng — máy chủ từ chối nếu đã tồn tại),
  danh mục, đơn giá, mô tả, và khối tải ảnh riêng (chỉ hiện sau khi sản phẩm đã được lưu lần đầu —
  ảnh gắn vào sản phẩm đã có `id`, không gắn vào bản nháp chưa lưu). Ảnh chấp nhận JPEG/PNG/WebP,
  có giới hạn dung lượng tối đa, thông báo lỗi rõ ràng nếu sai định dạng/quá lớn.
- Người chỉ có quyền `product:view` (Employee) xem được toàn bộ trang này nhưng không thấy nút
  "Sản phẩm mới"/"Quản lý danh mục" và không có menu `⋮` trên thẻ — chỉ-đọc hoàn toàn.

### 14.2 Kho hàng (`/warehouse`)

```
┌──────────────────────────────────────────────────────────────┐
│ Kho hàng                        [Ghi nhận biến động] [+ Kho mới]│
├──────────────────────────────────────────────────────────────┤
│ Tab phụ: [ Tồn kho ] [ Lịch sử biến động ]                      │
├──────────────────────────────────────────────────────────────┤
│ Kho          | Sản phẩm           | Số lượng                  │
│ Kho Hà Nội   | Laptop Dell XPS     | 12                        │
│ Kho Hà Nội   | RAM 16GB            | 340                       │
│ Kho Hồ Chí Minh | Chuột Gaming     | 85                        │
└──────────────────────────────────────────────────────────────┘
```

- Tab "Tồn kho": bảng số lượng hiện tại theo từng cặp Kho × Sản phẩm, lọc được theo Kho/Sản phẩm.
  Số lượng không bao giờ hiển thị âm (máy chủ đã chặn ở nguồn — xem Technical_Spec.md §22.2).
- Tab "Lịch sử biến động": bảng theo thời gian (mới nhất trước), mỗi dòng gồm thời điểm, kho, sản
  phẩm, loại (Nhập/Xuất/Điều chỉnh — huy hiệu màu riêng cho từng loại), số lượng biến động (có dấu
  `+`/`-`), ghi chú.
- Nút "Ghi nhận biến động" mở modal: chọn kho, sản phẩm, loại (Nhập/Xuất/Điều chỉnh), số lượng
  (người dùng LUÔN nhập số dương, trực quan hơn — riêng "Điều chỉnh" có thêm lựa chọn phụ "Tăng"/
  "Giảm" vì chiều điều chỉnh không cố định như Nhập/Xuất), ghi chú tuỳ chọn. Nếu chọn "Xuất"/"Điều
  chỉnh — Giảm" với số lượng vượt quá tồn kho hiện có, máy chủ từ chối ngay (thông báo lỗi "không đủ
  hàng trong kho", không tạo ra số âm).
- Nút "+ Kho mới" mở modal tạo/sửa kho (tên, địa chỉ). Xoá kho bị chặn nếu kho còn tồn bất kỳ sản
  phẩm nào (dù chỉ 1 đơn vị) — thông báo lỗi rõ ràng, không phải lỗi 500.
- Employee (chỉ có `warehouse:view`) xem được cả 2 tab nhưng không thấy nút "Ghi nhận biến
  động"/"Kho mới" — chỉ-đọc, giống mô hình phân quyền ở §14.1.
- Cả 2 trang (§14.1/§14.2) dùng đúng `AppShell`/sidebar có sẵn (§2) — không tự vẽ sidebar riêng,
  tránh lặp lại lỗi sidebar đè lên nhau đã sửa ở §2 (xem Technical_Spec.md §21.1).

### 14.3 Gán mặt hàng cho khách hàng — liên kết với §12.2 và §7

Mục đích chính của §14 không chỉ là có danh mục/kho riêng lẻ, mà là nối "mặt hàng" với "khách
hàng" để phục vụ phân tích xu hướng thị trường — cụ thể hoá bằng 2 phần đã cập nhật ở nơi khác
trong tài liệu này (tránh lặp lại nội dung 2 lần): khối **"Lịch sử mua hàng"** mới tại trang chi
tiết khách hàng (§12.2) là nơi gán 1 mặt hàng cho 1 khách hàng cụ thể; 2 biểu đồ **"Xu hướng doanh
số theo sản phẩm"**/**"Top sản phẩm bán nhiều nhất"** mới tại trang Báo cáo & Phân tích (§7) là
nơi dữ liệu đó được tổng hợp lại thành xu hướng thị trường.

## 15. Chatbot nội bộ *(kế hoạch chốt 24/10/2026, triển khai 24/10/2026, xem Technical_Spec.md §23)*

> Trạng thái: **ĐÃ TRIỂN KHAI, ĐÃ XÁC MINH SỐNG** (24/10/2026) — bố cục dưới đây khớp giao diện thật
> (`apps/web/src/features/chatbot`).

```
Nút tròn nổi góc dưới-phải, mọi trang đã đăng nhập (chỉ hiện khi có quyền chatbot:use):
                                                ┌───────────────────────────────────┐
                                                │ Trợ lý nội bộ  [Mới] [Lịch sử] [x] │
                                                ├───────────────────────────────────┤
                                                │  Bạn: Quy định làm việc từ xa?     │
                                                │                                     │
                                                │  Trợ lý: Nhân viên được làm việc   │
                                                │  từ xa tối đa 2 ngày/tuần...        │
                                                │  [📄 quy-dinh-lam-viec.pdf]  ← chip │
                                                │  Đã tra cứu: tài liệu               │
                                                ├───────────────────────────────────┤
                                                │ [Nhập câu hỏi...]           [Gửi]  │
                                                │ Hôm nay đã dùng 3/30 lượt           │
                                                └───────────────────────────────────┘
                                                                                [💬] ← nút nổi
```

- Bấm nút nổi mở panel hội thoại nhỏ (không phải trang riêng) — dùng được từ bất kỳ trang nào.
  Esc đóng panel; đóng panel không mất hội thoại, kể cả khi đang chờ trả lời.
- **Lịch sử:** danh sách hội thoại cũ, mở lại hoặc xoá (có hộp xác nhận).
- Không streaming câu trả lời — hiện "Đang xử lý…" trong lúc chatbot gọi tool/LLM nhiều bước; nút
  Gửi và ô nhập bị khoá cho tới khi có câu trả lời.
- Câu trả lời dựa trên Tài liệu kèm chip nguồn bấm được để mở tệp; dòng "Đã tra cứu: …" cho biết bot
  đã tra những nguồn nào (tài liệu, công việc, dự án, chấm công, nghỉ phép). Câu trả lời luôn phản ánh
  đúng quyền xem thật của người hỏi (gọi lại đúng API đã có, không có "chế độ xem rộng hơn" nào).
- Lỗi hiện ngay trong panel: hết lượt trong ngày, hội thoại đang bận, AI tạm thời không phản hồi.
- Lớp hiển thị: panel nằm trên nội dung trang nhưng dưới Topbar, menu, modal và toast; toast tự dời
  để không che panel; trên điện thoại (dưới 640px) toast chuyển lên đầu màn hình khi panel đang mở.

---

## Lịch sử thay đổi tài liệu

- **18/07/2026** — Khởi tạo tài liệu `Wireframe.md`: mô tả wireframe văn bản cho toàn bộ màn hình MVP (Đăng nhập/Đăng ký, App Shell, Dashboard, Dự án & Công việc, Tài liệu, Thông báo, Báo cáo & Phân tích, Quản trị), phác thảo trước màn hình Chấm công (Phase 2), và ghi chú responsive.
- **21/07/2026** — Cập nhật sau đợt code review toàn diện: bỏ bộ lọc "Phòng ban" khỏi danh sách dự án (§4.1) và trang Báo cáo & Phân tích (§7, đổi bảng chi tiết từ "theo phòng ban" sang "theo dự án"); làm rõ Modal Chia sẻ tài liệu (§5) trong MVP chỉ mang tính hiển thị, chưa phải access-control thực sự. Lý do: `Project`/`Task` không lưu `departmentId`, và `FileShare` hiện chưa được service enforce như quyền truy cập — xem Technical_Spec.md §14 để biết chi tiết và hướng phát triển.
- **22/07/2026** — Bổ sung sau phản hồi kiểm thử thực tế của người dùng trên bản build đã sửa lỗi ngày 22/07/2026 (xem Technical_Spec.md để biết chi tiết kỹ thuật đầy đủ):
  - §2 (App Shell): ô tìm kiếm Topbar từ chỗ chỉ là placeholder tĩnh ("sắp ra mắt") trở thành tìm kiếm tổng hợp thật (client-side, theo Dự án/Công việc/Thành viên/Thư mục); menu `[Tên user ▾]` mở thêm mục "Hồ sơ cá nhân" (trước đó bị khoá/không làm gì).
  - §5 (Tài liệu): bổ sung khả năng mở/xem tệp trực tiếp trong tab trình duyệt (click tên tệp hoặc mục "Xem tệp"), tách biệt với "Tải xuống" (luôn ép lưu file).
  - §11 (mới): trang Hồ sơ cá nhân — hiển thị dữ liệu thật của người dùng đang đăng nhập, không bịa field mới ngoài entity `User` đã đặc tả.
- **22/07/2026 (review toàn dự án)** — Sau đợt walkthrough toàn bộ dự án theo vai trò giảng viên phản biện (ClaudeRule.md mục 6) và sửa lỗi theo mức độ nghiêm trọng (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục review 22/07/2026), phần thay đổi có ảnh hưởng trực tiếp tới UI:
  - §8 (Quản trị > Thành viên): hành động `⋮` bổ sung "Kích hoạt lại" cho tài khoản đã bị vô hiệu hoá (trước đó không có đường quay lại nào qua giao diện).
  - Không có màn hình/luồng UI mới nào khác phát sinh từ đợt review này — phần lớn phát hiện và sửa lỗi nằm ở tầng backend (RBAC, race condition, xác thực, xử lý dữ liệu) hoặc là sửa lại đúng hành vi đã đặc tả (ví dụ: mở tệp trực tiếp không còn im lặng bị chặn bởi popup blocker) thay vì thay đổi giao diện.
- **25/07/2026 (review vòng 2)** — Đợt walkthrough lần 2 theo cùng quy trình (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục review 25/07/2026). Thay đổi có ảnh hưởng trực tiếp tới UI:
  - **§10 (Ghi chú Responsive):** hành vi "Sidebar thu gọn còn icon" ở breakpoint tablet (`768px–1023px`) đã có trong đặc tả từ 18/07/2026 nhưng CHƯA từng được lập trình (hạ tầng state đã có sẵn nhưng không nơi nào gọi tới) — phát hiện qua đợt review này, nay đã lập trình đúng đặc tả: tự thu gọn khi vào khoảng tablet, tự mở lại khi ra khỏi khoảng đó, TRỪ khi người dùng đã tự tay bật/tắt sidebar thủ công (giữ nguyên lựa chọn của người dùng, không tự ý ghi đè).
  - Thông báo lỗi validate dữ liệu đầu vào (vd nhập sai định dạng email, mật khẩu quá ngắn ở form Mời thành viên/Đăng ký tổ chức) trước đó hiện bằng tiếng Anh — nay hiện bằng tiếng Việt, đúng ClaudeRule.md mục 1 (không phát sinh màn hình/luồng mới, chỉ đổi nội dung thông báo lỗi đã có).
  - Không có màn hình/luồng UI mới nào khác — phần lớn phát hiện của đợt này (leo thang đặc quyền RBAC, nguy cơ sập tiến trình Gateway, sai lệch KPI, hạ tầng Docker/seed script) đều thuộc tầng backend, không đổi giao diện.
- **28/07/2026 (nâng cấp chất lượng Frontend)** — Đợt nâng cấp đầu tiên trong loạt nâng cấp đã lên kế hoạch (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục 28/07/2026). Không có màn hình/bố cục mới nào — thay đổi chủ yếu là chia nhỏ bundle theo route (không ảnh hưởng giao diện), bộ kiểm thử E2E mới, và khả năng tiếp cận (a11y): mọi modal/dialog trong ứng dụng giờ quản lý focus đúng chuẩn (focus vào bên trong khi mở, "nhốt" Tab trong dialog, trả focus khi đóng — không thấy được bằng mắt nhưng thay đổi hành vi thao tác bằng bàn phím), thêm liên kết "Bỏ qua tới nội dung chính" (ẩn, chỉ hiện khi Tab tới), và một loạt `aria-label` cho các control trước đó chỉ nhận diện được bằng mắt (ma trận phân quyền, tìm kiếm, avatar người phụ trách...).
- **28/07/2026 (Dead Letter Queue)** — Hạng mục thứ 2 trong loạt nâng cấp (chi tiết kỹ thuật ở Technical_Spec.md §4.5). Duy nhất 1 thay đổi UI-visible: §8 (Quản trị hệ thống) có thêm tab "Sự kiện lỗi hệ thống".
- **28/07/2026 (Access-control tài liệu theo thư mục)** — Hạng mục thứ 3 (chi tiết kỹ thuật ở Technical_Spec.md, mục cùng tên). §5 (Tài liệu) cập nhật: biểu tượng khoá cho thư mục "Hạn chế truy cập", menu `⋮` của thư mục có thêm "Hạn chế truy cập"/"Mở cho cả tổ chức" và "Quản lý chia sẻ" (chỉ hiện với người tạo thư mục/Org Admin), modal chia sẻ (cả thư mục lẫn tệp) có thêm lựa chọn chia sẻ theo Phòng ban bên cạnh Người dùng.
- **28/07/2026 (KPI theo phòng ban)** — Hạng mục thứ 4 và cuối cùng trước tính năng AI (chi tiết kỹ thuật ở Technical_Spec.md §4.6). §3 (Dashboard) và §7 (Báo cáo & Phân tích) đều có lại bộ lọc "Phòng ban" (từng bị gỡ 21/07/2026) — không áp dụng cho biểu đồ xu hướng theo tuần (giới hạn kỹ thuật). Nhân tiện sửa lại mô tả sai lệch ở §7 (nguồn dữ liệu thực tế là `fact_task_events`, không phải continuous aggregate như bản mô tả cũ).
- **28/07/2026 (Kiểm tra tổng thể hệ thống — "ultimate check")** — Trước khi bắt đầu tính năng AI, thực hiện kiểm tra toàn diện toàn hệ thống (chi tiết kỹ thuật đầy đủ ở Technical_Spec.md, mục cùng ngày). Duy nhất 1 thay đổi UI-visible: §8 (Quản trị hệ thống) — tab "Sự kiện lỗi hệ thống" có thêm cột "Phạm vi" (xem §8 ở trên) sau khi phát hiện một nhóm lỗi DLQ trước đó vô hình hoàn toàn với giao diện.
- **28/07/2026 (Nhận xét AI)** — Hạng mục đầu tiên của loạt nâng cấp tính năng AI (chi tiết kỹ thuật ở Technical_Spec.md §4.7). §7 (Báo cáo & Phân tích) có thêm thẻ "Nhận xét AI" với nút bấm theo yêu cầu (không tự động) — xem §7 ở trên. Không có màn hình/luồng UI mới nào khác.
- **05/08/2026 (CRM-lite)** — Hạng mục thứ hai trong 2 hạng mục mở rộng còn lại sau khi dự án chuyển sang mô hình 3 người (chi tiết kỹ thuật ở Technical_Spec.md §16). §12 (mới): danh sách khách hàng + Kanban pipeline bán hàng 6 giai đoạn cho từng khách hàng — khác Kanban Công việc (§4.2) ở chỗ 4 giai đoạn đầu di chuyển tự do qua lại lẫn nhau, chỉ "Thắng"/"Thua" là trạng thái cuối.
- **05/08/2026 (HRM-lite, tiếp)** — Hạng mục cuối cùng trong danh sách mở rộng đã thống nhất ban đầu (chi tiết kỹ thuật ở Technical_Spec.md §17). §9 viết lại hoàn toàn (thay thế khung sườn phác thảo từ 18/07/2026) để khớp đúng những gì đã lập trình: bỏ dạng lịch tháng đánh dấu đi trễ/nghỉ (đơn giản hoá thành bảng danh sách), thêm §9.3 mô tả modal camera chấm công — component camera đầu tiên của dự án, chỉ chụp ảnh làm bằng chứng, không nhận diện khuôn mặt (xem Technical_Spec.md §17).
- **13/08/2026 (cờ vị trí chấm công)** — §9.1 cập nhật: nhãn "Tại văn phòng"/"Ngoài văn phòng" (cờ mềm dựa trên GPS, không chặn check-in/out) trên khối "Hôm nay"/"Lịch sử chấm công", cộng thêm khối bảng mới "Chấm công toàn tổ chức" chỉ hiện với Manager/Org Admin (cùng cơ chế 403-tự-ẩn với "Chờ duyệt" ở §9.2). Chi tiết kỹ thuật đầy đủ ở Technical_Spec.md §17 (mục bổ sung 13/08/2026).
- **20/08/2026 (sửa 4 báo cáo lỗi thủ công)** — §1 cập nhật: ô mật khẩu có nút hiện/ẩn tự vẽ (thay cho nút có sẵn của trình duyệt, từng mất đồng bộ) và cảnh báo (không chặn) khi phát hiện dấu tiếng Việt gõ nhầm vào mật khẩu. Không có màn hình/luồng UI mới nào khác — 2 báo cáo còn lại đã sửa (dữ liệu thành viên/tài liệu của tổ chức cũ còn sót lại sau khi đổi tài khoản, modal mất focus khi gõ) là lỗi hành vi/cache, không đổi bố cục hay thêm phần tử giao diện nào. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md`, mục cùng ngày.
- **20/08/2026 → 21 (Đa ngôn ngữ Việt/Anh/Nhật)** — §0 và §2 cập nhật: nút chọn ngôn ngữ (🌐) mới ở góc trên-phải màn Đăng nhập/Đăng ký (§1) và trên Topbar mọi trang đã đăng nhập (§2), đổi được giữa Tiếng Việt (mặc định)/English/日本語, lựa chọn được ghi nhớ. Áp dụng cho TOÀN BỘ màn hình đã mô tả trong tài liệu này — không liệt kê lại từng mục vì không đổi bố cục/thêm phần tử nào khác ngoài việc mọi nhãn/nút/thông báo đều có bản dịch. Chi tiết kỹ thuật đầy đủ (kiến trúc i18next, danh mục mã lỗi backend, 2 lỗi thật phát hiện qua xác minh trực tiếp) ở `Technical_Spec.md` §18.
- **24/09/2026 (nhập Excel hàng loạt + Analytics nâng cao)** — §7 (Báo cáo & Phân tích) cập nhật lại cho khớp thiết kế "Nhận xét AI" đã đổi từ 22/09/2026 (bộ thẻ có cấu trúc + biểu đồ so sánh, không còn 1 đoạn văn tự do), cộng 3 mục mới: bấm vào 1 thanh biểu đồ mở panel drill-down (phễu Tổng → Chưa xong → Quá hạn → Tập trung ở 1 người); khối "Phát hiện bất thường" mới (Isolation Forest thật, `apps/ml-service` — service Python đầu tiên của dự án); khối "Kế hoạch hành động" xuất hiện trong thẻ Nhận xét AI khi đã có dữ liệu bất thường. §8 (Quản trị > Thành viên) thêm nút "Nhập từ Excel" cạnh "Mời thành viên". Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §19.
- **25/09/2026 (xoá vĩnh viễn tài khoản)** — §8 (Quản trị > Thành viên) cập nhật: hành động `⋮` của tài khoản đã vô hiệu hoá có thêm "Xoá vĩnh viễn" (kèm `ConfirmDialog` cảnh báo riêng, khác "Vô hiệu hoá" ở chỗ không thể hoàn tác) — khắc phục sau khi người dùng phản hồi tài khoản rác (do kiểm thử tự động tạo ra) hiển thị vĩnh viễn dù đã vô hiệu hoá. Không có màn hình/luồng UI mới nào khác — phần còn lại của đợt sửa lỗi này (endpoint Super Admin mới, tách môi trường kiểm thử tự động) không thuộc phạm vi tài liệu này. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §19.6.
- **28/09/2026 (Nhắn tin nội bộ)** — §13 (mới): trang Nhắn tin 2 cột (danh sách hội thoại + khung chat), hỗ trợ cả 1:1 và nhóm, cập nhật tức thời qua WebSocket riêng. Mục còn treo lại từ 17/09/2026, lần đầu được đặc tả và lập trình. Cùng đợt: `ecap-mobile` có thêm tab thứ 7 cùng chức năng (trừ quản lý thành viên nhóm). Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §20.
- **03/10/2026 (tái cấu trúc điều hướng + gộp Lịch công ty + phát hiện nghỉ phép qua chat)** — §2 viết lại hoàn toàn (sidebar chính đổi thành icon-rail mở rộng khi trỏ chuột vào, "Trang chủ" gộp Dự án/Tài liệu/Khách hàng qua 1 sidebar phụ); §6 viết lại (xoá trang Thông báo riêng, dropdown chuông trở thành giao diện duy nhất); §9.1/§9.2 cập nhật (Lịch công ty rời Quản trị, gộp vào Nghỉ phép theo tỷ lệ 60:40 kèm mô hình phân quyền theo cấp bậc mới; thêm trang xem lịch sử chấm công/nghỉ phép theo từng nhân viên cho Manager/Org Admin); §13 bổ sung chip "Hẹn lịch nghỉ" tự nhận diện cụm từ ngày/giờ trong tin nhắn của chính mình. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §21.
- **16/10/2026 (Danh mục sản phẩm & Kho hàng)** — §14 (mới): 2 trang `/products`/`/warehouse` cho tính năng mới hoàn toàn (danh mục sản phẩm cùng 1 chủ đề máy tính/linh kiện laptop-PC, kho hàng với ghi nhận nhập/xuất/điều chỉnh, số lượng không bao giờ âm). §12.2 (Chi tiết khách hàng) bổ sung khối "Lịch sử mua hàng" — cơ chế gán mặt hàng cho từng khách hàng phục vụ phân tích xu hướng thị trường. §7 (Báo cáo & Phân tích) bổ sung 2 biểu đồ mới ("Xu hướng doanh số theo sản phẩm", "Top sản phẩm bán nhiều nhất"). Cả 2 trang mới dùng đúng `AppShell`/sidebar có sẵn ở §2, không tự vẽ sidebar riêng — tránh tái diễn lỗi sidebar đè lên nhau đã sửa ngày 03/10/2026. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §22.
- **24/10/2026 (Chatbot nội bộ — kế hoạch)** — §15 (mới): phác thảo UI bubble chat nổi xuyên suốt app cho tính năng RAG + tool-calling lai đã bàn bạc và chốt kiến trúc trước khi code. **Chỉ là kế hoạch — chưa có màn hình/code nào thật.** Đặc tả kỹ thuật đầy đủ ở `Technical_Spec.md` §23, theo dõi trạng thái ở `Doc/Upgrade.md` Tier 5.
- **24/10/2026 (Nhận diện khuôn mặt cho Chấm công)** — §9.1 bổ sung badge "Khớp khuôn mặt"/"Không khớp" (cờ mềm, cùng cơ chế với badge GPS đã có) ở mọi nơi hiển thị bằng chứng chấm công; §11 bổ sung khối đăng ký khuôn mặt (opt-in bắt buộc đồng ý) vào trang Hồ sơ cá nhân. Đảo ngược có chủ đích quyết định "không nhận diện khuôn mặt" ban đầu của §9 (05/08/2026), theo yêu cầu trực tiếp. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §24.
- **24/10/2026 (Chatbot nội bộ — triển khai)** — §15 viết lại từ phác thảo kế hoạch thành mô tả giao diện thật: nút nổi chỉ hiện khi có quyền `chatbot:use`, panel có Hội thoại mới/Lịch sử, chip nguồn tài liệu bấm mở được, dòng "Đã tra cứu", số lượt đã dùng trong ngày, lỗi hiển thị ngay trong panel, nút Gửi khoá khi đang chờ trả lời.
