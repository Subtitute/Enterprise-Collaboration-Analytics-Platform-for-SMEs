// 25/09/2026: wrapper seed 1 to chuc RIENG cho Playwright (e2e/) - khong bao gio dung chung to
// chuc demo mac dinh (`npm run seed`, xem scripts/seed.js DEMO_ORG_NAME/DEMO_ADMIN_EMAIL) ma
// nguoi dung THAT xem/trinh bay dan chung do an. Truoc day moi lan chay E2E deu tao du lieu (thanh
// vien "Thanh vien E2E <timestamp>", khach hang "Khach hang E2E <timestamp>"...) THANG vao to chuc
// demo do, tich luy vinh vien qua rat nhieu lan chay - loi da duoc nguoi dung phan anh nhieu lan.
// Fix goc: seed.js (khong doi logic sinh du lieu) nhung doc SEED_ORG_NAME/SEED_ADMIN_EMAIL/
// SEED_ADMIN_PASSWORD tu bien moi truong - script nay chi ghi de 3 bien do roi goi lai y nguyen
// scripts/seed.js nhu 1 tien trinh con (spawn, khong require() truc tiep vi seed.js tu goi main()
// khi load module). Dung spawn thay vi dat bien moi truong ngay trong "scripts" cua package.json
// de tranh khac cu phap gan bien moi truong giua PowerShell/cmd (Windows) va bash (Linux/CI), khong
// can them dependency (vd cross-env).
const { spawnSync } = require('child_process');
const path = require('path');

const env = {
  ...process.env,
  SEED_ORG_NAME: 'E2E Test Org (khong dung de demo)',
  SEED_ADMIN_EMAIL: 'admin@e2e-test.local',
  SEED_ADMIN_PASSWORD: 'Password123!',
};

const result = spawnSync(process.execPath, [path.join(__dirname, 'seed.js')], {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
