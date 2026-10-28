// 28/10/2026: seed to chuc demo thu 2 - cong ty noi that - xay dung hu cau "Noi that An Gia" (scripts/seed-datasets/
// noi-that.js) - chung minh ECAP dung cho nganh khac ma khong sua code ung dung, chi doi du lieu. Chay seed.js roi
// seed-inventory.js voi SEED_DATASET=noi-that; idempotent nhu seed.js (to chuc/phong ban/du an theo ten).
// Dang nhap: admin@demo-noithat.vn / Password123! (nhan vien: email trong noi-that.js them hau to +<so>).
//
// Cach chay: npm run seed:noi-that   (sau khi stack Docker da chay; khong anh huong to chuc demo mac dinh)
const { spawnSync } = require('child_process');
const path = require('path');

const env = { ...process.env, SEED_DATASET: 'noi-that' };

for (const script of ['seed.js', 'seed-inventory.js']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
