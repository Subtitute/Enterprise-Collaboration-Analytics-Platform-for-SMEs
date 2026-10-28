// 28/10/2026: bo du lieu demo nganh noi that - xay dung (cong ty hu cau "Noi that An Gia") - chung minh ECAP
// dung cho nganh khac ma KHONG sua code ung dung: chi doi du lieu seed (phong ban, nhan vien, cong trinh, khach
// hang, vat tu, tai lieu chinh sach). Chon bang SEED_DATASET=noi-that (xem index.js, npm run seed:noi-that).
// Moi ten cong ty/khach hang/ten mien email deu hu cau; ten mien .vn co tien to "demo-"/"khach-demo".

const ORG_NAME = 'Nội thất An Gia (Demo)';
const ADMIN_EMAIL = 'admin@demo-noithat.vn';

// Giu ten "Kinh doanh" de migrate-demo-ownership.js giao khach hang cho dung phong ban nhu to chuc mac dinh.
const DEPARTMENTS = ['Kinh doanh', 'Thiết kế', 'Thi công', 'Kế toán - Nhân sự'];

const EMPLOYEES = [
  { fullName: 'Trịnh Minh Khoa', email: 'khoa.trinh@demo-noithat.vn' },
  { fullName: 'Lê Thị Hồng', email: 'hong.le@demo-noithat.vn' },
  { fullName: 'Nguyễn Quốc Huy', email: 'huy.nguyen@demo-noithat.vn' },
  { fullName: 'Phan Thị Lan', email: 'lan.phan@demo-noithat.vn' },
  { fullName: 'Đinh Văn Mạnh', email: 'manh.dinh@demo-noithat.vn' },
  { fullName: 'Võ Thị Ngân', email: 'ngan.vo@demo-noithat.vn' },
  { fullName: 'Hồ Văn Sơn', email: 'son.ho@demo-noithat.vn' },
  { fullName: 'Cao Thị Thảo', email: 'thao.cao@demo-noithat.vn' },
];

// Moi du an la 1 cong trinh cua 1 khach hang trong CUSTOMERS (cung chi so 0-4).
const PROJECTS = [
  { name: 'Nội thất căn hộ 3PN - Tây Mỗ', description: 'Thiết kế và thi công trọn gói nội thất căn hộ 3 phòng ngủ, 98 m²' },
  { name: 'Văn phòng Logistics Hòa Bình', description: 'Thi công văn phòng 400 m²: vách kính, trần thạch cao, bàn làm việc mở' },
  { name: 'Cải tạo nhà phố 4 tầng - Cầu Giấy', description: 'Cải tạo kết cấu, ốp lát, nội thất 4 tầng và tum' },
  { name: 'Showroom gốm Bát Tràng', description: 'Kệ trưng bày, chiếu sáng điểm và quầy lễ tân cho showroom 150 m²' },
  { name: 'Biệt thự song lập - Long Biên', description: 'Hoàn thiện nội thất cao cấp biệt thự 3 tầng, sân vườn' },
];

// Cong trinh cai tao nha pho tre tien do (THI CONG cham, phong Thiet ke vuot troi) - tin hieu cho "Nhan xet AI".
const STRUGGLE_DEPT_NAME = 'Thi công';
const THRIVE_DEPT_NAME = 'Thiết kế';
const AT_RISK_PROJECT_INDEX = 2;

const TASK_TITLES = [
  'Khảo sát hiện trạng công trình',
  'Lên phương án bố trí mặt bằng',
  'Dựng phối cảnh 3D',
  'Bóc tách khối lượng vật tư',
  'Lập dự toán và báo giá',
  'Đặt hàng gỗ công nghiệp',
  'Thi công trần thạch cao',
  'Lắp đặt tủ bếp',
  'Sơn hoàn thiện',
  'Nghiệm thu bàn giao hạng mục',
];

const CUSTOMERS = [
  { name: 'Trần Văn Thịnh', company: 'Chủ căn hộ 3PN Tây Mỗ', email: 'thinh.tran@khach-demo.vn', phone: '0904111222', notes: 'Ưu tiên phong cách tối giản, ngân sách khoảng 600 triệu' },
  { name: 'Nguyễn Thu Hằng', company: 'Công ty CP Logistics Hòa Bình', email: 'hang.nguyen@khach-demo.vn', phone: '0913222333', notes: 'Cần hoàn thiện văn phòng trước quý 1' },
  { name: 'Phạm Quang Vinh', company: 'Chủ nhà phố Cầu Giấy', email: 'vinh.pham@khach-demo.vn', phone: '0982333444', notes: 'Cải tạo khi gia đình vẫn ở tầng 1' },
  { name: 'Lê Minh Châu', company: 'Showroom gốm Minh Châu', email: 'chau.le@khach-demo.vn', phone: '0976444555', notes: 'Cần chiếu sáng làm nổi màu men gốm' },
  { name: 'Đoàn Thị Yến', company: 'Chủ biệt thự Long Biên', email: 'yen.doan@khach-demo.vn', phone: '0905555666', notes: 'Khách hàng giới thiệu, yêu cầu vật liệu cao cấp' },
  { name: 'Vương Đức Anh', company: 'Chuỗi cà phê Gác Nhỏ', email: 'anh.vuong@khach-demo.vn', phone: '0937666777', notes: 'Muốn đồng bộ thiết kế cho 3 chi nhánh' },
  { name: 'Hà Thị Phương', company: 'Phòng khám nha khoa Smile Care', email: 'phuong.ha@khach-demo.vn', phone: '0918777888', notes: '' },
  { name: 'Tạ Văn Quân', company: 'Nhà hàng Bếp Quê', email: 'quan.ta@khach-demo.vn', phone: '0945888999', notes: 'Cải tạo khu bếp và 2 phòng VIP' },
  { name: 'Kiều Thị Liên', company: 'Căn hộ dịch vụ Liên Studio', email: 'lien.kieu@khach-demo.vn', phone: '0967999000', notes: 'Nội thất 5 căn studio cho thuê' },
  { name: 'Mai Xuân Trường', company: 'Trường mầm non Hoa Mai', email: 'truong.mai@khach-demo.vn', phone: '0926000111', notes: 'Yêu cầu vật liệu an toàn cho trẻ em' },
];

const DEAL_TEMPLATES = [
  { customer: 0, title: 'Hợp đồng thiết kế thi công căn hộ 3PN', value: 585000000, stage: 'WON', closeOffsetDays: -35 },
  { customer: 0, title: 'Phát sinh tủ quần áo phòng ngủ phụ', value: 42000000, stage: 'NEGOTIATION', closeOffsetDays: 10 },
  { customer: 1, title: 'Thi công văn phòng 400 m²', value: 920000000, stage: 'WON', closeOffsetDays: -20 },
  { customer: 1, title: 'Gói bảo trì nội thất văn phòng 12 tháng', value: 36000000, stage: 'PROPOSAL', closeOffsetDays: 30 },
  { customer: 2, title: 'Cải tạo nhà phố 4 tầng', value: 760000000, stage: 'WON', closeOffsetDays: -50 },
  { customer: 2, title: 'Hệ tủ âm tường tầng 4', value: 68000000, stage: 'CONTACTED', closeOffsetDays: 25 },
  { customer: 3, title: 'Kệ trưng bày và chiếu sáng showroom', value: 310000000, stage: 'WON', closeOffsetDays: -15 },
  { customer: 3, title: 'Biển hiệu và quầy lễ tân', value: 55000000, stage: 'NEGOTIATION', closeOffsetDays: 12 },
  { customer: 4, title: 'Hoàn thiện nội thất biệt thự', value: 1450000000, stage: 'NEGOTIATION', closeOffsetDays: 20 },
  { customer: 4, title: 'Thiết kế cảnh quan sân vườn', value: 120000000, stage: 'PROPOSAL', closeOffsetDays: 40 },
  { customer: 5, title: 'Thiết kế đồng bộ 3 chi nhánh cà phê', value: 270000000, stage: 'PROPOSAL', closeOffsetDays: 35 },
  { customer: 5, title: 'Thi công chi nhánh thứ nhất', value: 180000000, stage: 'NEW', closeOffsetDays: 60 },
  { customer: 6, title: 'Nội thất phòng khám 2 ghế nha', value: 240000000, stage: 'CONTACTED', closeOffsetDays: 45 },
  { customer: 6, title: 'Khảo sát và tư vấn bố trí', value: 0, stage: 'NEW', closeOffsetDays: 15 },
  { customer: 7, title: 'Cải tạo bếp nhà hàng', value: 330000000, stage: 'LOST', closeOffsetDays: -12 },
  { customer: 7, title: 'Nội thất 2 phòng VIP', value: 150000000, stage: 'CONTACTED', closeOffsetDays: 28 },
  { customer: 8, title: 'Nội thất 5 căn studio', value: 410000000, stage: 'NEGOTIATION', closeOffsetDays: 8 },
  { customer: 8, title: 'Gói rèm và đèn trang trí', value: 48000000, stage: 'NEW', closeOffsetDays: 50 },
  { customer: 9, title: 'Nội thất 6 phòng học', value: 360000000, stage: 'LOST', closeOffsetDays: -30 },
  { customer: 9, title: 'Sân chơi trong nhà', value: 95000000, stage: 'PROPOSAL', closeOffsetDays: 32 },
];

// Kho vat tu (seed-inventory.js) - khong co anh san pham: giao dien tu hien bieu tuong thay the.
const INVENTORY = {
  CATEGORIES: [
    { name: 'Gỗ công nghiệp', description: 'Ván MDF, HDF, plywood dùng đóng tủ, kệ, vách' },
    { name: 'Sơn và keo', description: 'Sơn PU, sơn lót, keo dán gỗ' },
    { name: 'Phụ kiện tủ', description: 'Bản lề, ray trượt, tay nắm' },
    { name: 'Đèn chiếu sáng', description: 'Đèn âm trần, đèn thả, đèn rọi trưng bày' },
    { name: 'Nội thất hoàn thiện', description: 'Sofa, bàn ghế, giường đóng sẵn' },
  ],
  PRODUCTS: [
    { category: 'Gỗ công nghiệp', name: 'Ván MDF chống ẩm phủ melamine 17mm', sku: 'GO-MDF-17', unitPrice: 485000, description: 'Tấm 1220x2440mm, dùng cho tủ bếp và tủ áo' },
    { category: 'Gỗ công nghiệp', name: 'Ván HDF chịu nước 18mm', sku: 'GO-HDF-18', unitPrice: 650000, description: 'Tấm 1220x2440mm, khu vực ẩm như bếp, nhà tắm' },
    { category: 'Gỗ công nghiệp', name: 'Plywood phủ veneer sồi 18mm', sku: 'GO-PLY-SOI-18', unitPrice: 720000, description: 'Bề mặt vân gỗ tự nhiên cho vách trang trí' },
    { category: 'Sơn và keo', name: 'Sơn PU bóng nội thất (1 lít)', sku: 'SON-PU-BONG', unitPrice: 185000, description: 'Sơn phủ hoàn thiện đồ gỗ' },
    { category: 'Sơn và keo', name: 'Keo dán gỗ PVA (1 kg)', sku: 'KEO-PVA-1KG', unitPrice: 65000, description: 'Keo gốc nước cho mộng ghép' },
    { category: 'Phụ kiện tủ', name: 'Bản lề giảm chấn tủ bếp (bộ 2 cái)', sku: 'BL-GIAMCHAN', unitPrice: 45000, description: 'Đóng êm, chỉnh 3 chiều' },
    { category: 'Phụ kiện tủ', name: 'Ray trượt bi 3 tầng 45cm (bộ)', sku: 'RAY-BI-45', unitPrice: 120000, description: 'Tải trọng 35 kg' },
    { category: 'Phụ kiện tủ', name: 'Tay nắm tủ inox 128mm', sku: 'TAYNAM-128', unitPrice: 35000, description: 'Inox 304 mờ' },
    { category: 'Đèn chiếu sáng', name: 'Đèn LED âm trần 9W', sku: 'LED-AMTRAN-9W', unitPrice: 95000, description: 'Ánh sáng trung tính 4000K' },
    { category: 'Đèn chiếu sáng', name: 'Đèn thả trang trí phòng ăn', sku: 'DEN-THA-PA', unitPrice: 1450000, description: 'Chao kim loại sơn tĩnh điện' },
    { category: 'Nội thất hoàn thiện', name: 'Sofa góc vải nỉ 3,2m', sku: 'SOFA-GOC-32', unitPrice: 18500000, description: 'Khung gỗ tự nhiên, đệm mút D40' },
    { category: 'Nội thất hoàn thiện', name: 'Bàn làm việc gỗ sồi 1m4', sku: 'BAN-SOI-140', unitPrice: 4200000, description: 'Chân sắt sơn tĩnh điện' },
  ],
  WAREHOUSES: [
    { name: 'Kho vật tư Long Biên', address: 'Phường Thạch Bàn, Long Biên, Hà Nội' },
    { name: 'Xưởng mộc Đông Anh', address: 'Xã Vân Nội, Đông Anh, Hà Nội' },
  ],
  POPULAR_SKUS: ['GO-MDF-17', 'BL-GIAMCHAN', 'LED-AMTRAN-9W', 'SON-PU-BONG'],
};

// Tai lieu chinh sach toan cong ty (migrate-project-documents.js) - sinh DOCX tu van ban ngay luc seed (index.js),
// khong them tep nhi phan vao repo. So tay co muc lam them gio/quen cham cong de 2 cau goi y cua Tro ly ECAP
// (Technical_Spec.md §23.9) cung tra loi duoc o to chuc nay.
const POLICY_DOCUMENTS = [
  {
    folder: 'Chính sách công ty',
    file: 'Quy trình thi công và nghiệm thu.docx',
    title: 'Quy trình thi công và nghiệm thu — Nội thất An Gia',
    sections: [
      ['1. Phạm vi', 'Áp dụng cho mọi công trình nội thất nhà ở, văn phòng, showroom do An Gia thiết kế và thi công.'],
      ['2. Các bước thực hiện', 'Khảo sát hiện trạng → phương án mặt bằng → phối cảnh 3D → báo giá và ký hợp đồng → đặt vật tư → thi công → nghiệm thu từng hạng mục → bàn giao.'],
      ['3. Giao việc trên ECAP', 'Mỗi công trình là một dự án trên ECAP. Chỉ huy trưởng tạo công việc cho từng hạng mục, giao cho người phụ trách và cập nhật trạng thái hằng ngày. Bản vẽ, báo giá, biên bản lưu trong thư mục tài liệu của dự án; chỉ thành viên dự án xem được.'],
      ['4. Nghiệm thu', 'Mỗi hạng mục được nghiệm thu với khách hàng trước khi chuyển sang hạng mục sau. Biên bản nghiệm thu có chữ ký hai bên, chụp ảnh và tải lên thư mục dự án trong ngày.'],
      ['5. Bảo hành', 'Đồ gỗ và phụ kiện được bảo hành 24 tháng kể từ ngày bàn giao; yêu cầu bảo hành tiếp nhận qua phòng Kinh doanh.'],
    ],
  },
  {
    folder: 'Sổ tay nhân viên',
    file: 'Sổ tay nhân viên An Gia.docx',
    title: 'Sổ tay nhân viên — Công ty TNHH Nội thất An Gia',
    sections: [
      ['1. Về An Gia', 'An Gia thiết kế và thi công nội thất nhà ở, văn phòng và showroom tại Hà Nội. Công ty có bốn phòng ban: Kinh doanh, Thiết kế, Thi công, Kế toán - Nhân sự.'],
      ['2. Giờ làm việc', 'Khối văn phòng làm việc từ 8:00 đến 17:30, thứ Hai đến thứ Sáu và sáng thứ Bảy. Đội thi công làm việc tại công trình từ 7:30 đến 17:00 theo lịch của chỉ huy trưởng.'],
      ['3. Chấm công', 'Mọi nhân viên Check-in khi bắt đầu và Check-out khi kết thúc ca trên ECAP, kèm ảnh chụp. Nhân viên thi công chấm công ngay tại công trình; hệ thống ghi vị trí GPS để Quản lý đối chiếu. Đối chiếu khuôn mặt là tuỳ chọn và không bao giờ chặn chấm công.'],
      ['4. Quên chấm công', 'Gửi giải trình trên ECAP trong vòng 24 giờ, ghi rõ giờ vào/ra thực tế và lý do. Quản lý phòng ban duyệt giải trình.'],
      ['5. Làm thêm giờ', 'Đăng ký làm thêm giờ trên ECAP trước khi làm, Quản lý phòng ban duyệt. Mỗi người làm thêm tối đa 40 giờ/tháng.'],
      ['6. Nghỉ phép', 'Mỗi năm có 12 ngày phép năm. Gửi đơn trên ECAP trước ít nhất 2 ngày làm việc; nghỉ ốm báo cho Quản lý trong ngày và bổ sung đơn sau.'],
      ['7. An toàn tại công trình', 'Luôn đội mũ bảo hộ và đi giày bảo hộ. Không làm việc trên cao khi chưa có dây an toàn. Mọi sự cố báo ngay cho chỉ huy trưởng.'],
      ['8. Trợ lý ECAP', 'Trợ lý trả lời câu hỏi về nội quy, công việc, ngày phép và chấm công hôm nay của chính bạn, dựa trên tài liệu bạn được xem.'],
    ],
  },
];

// Chua co tai lieu rieng cho tung cong trinh (seed-project-docs.js bo qua).
const PROJECT_DOCUMENTS = [];

module.exports = {
  ORG_NAME,
  ADMIN_EMAIL,
  DEPARTMENTS,
  EMPLOYEES,
  PROJECTS,
  STRUGGLE_DEPT_NAME,
  THRIVE_DEPT_NAME,
  AT_RISK_PROJECT_INDEX,
  TASK_TITLES,
  CUSTOMERS,
  DEAL_TEMPLATES,
  INVENTORY,
  POLICY_DOCUMENTS,
  PROJECT_DOCUMENTS,
};
