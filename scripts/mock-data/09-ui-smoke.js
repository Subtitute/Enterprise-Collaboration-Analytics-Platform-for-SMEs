// 24/10/2026: kich ban 09 - kiem thu giao dien bang trinh duyet that (Playwright, dung goi
// @playwright/test cua thu muc e2e/). (1) Moi vai tro mo cac trang chinh: khong co loi JS chua bat,
// khong co phan hoi API 5xx. (2) Org Admin mo ma tran phan quyen: moi quyen deu co nhom module va
// nhan dich (khong con nhom "Khac"), bat/tat duoc quyen chatbot:use cua vai tro Employee - kich ban
// tra lai dung bo quyen ban dau o cuoi (ke ca khi loi giua chung).
// Chay: node scripts/mock-data/09-ui-smoke.js   (WEB mac dinh http://localhost, doi bang ECAP_WEB_URL)
const path = require('path');
const { ACCOUNTS, api, list, check, summary } = require('./lib');
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.join(__dirname, '../../e2e')] }));
const WEB = process.env.ECAP_WEB_URL || 'http://localhost';
const PAGES = {
  admin: ['/dashboard', '/admin/members', '/admin/departments', '/admin/roles', '/analytics', '/documents', '/warehouse'],
  manager: ['/dashboard', '/projects', '/documents', '/customers', '/products', '/warehouse', '/attendance', '/leave-requests', '/messages', '/analytics'],
  employee: ['/dashboard', '/projects', '/documents', '/customers', '/products', '/attendance', '/leave-requests', '/messages', '/profile'],
};

async function login(page, who) {
  // domcontentloaded: khong cho stylesheet Google Fonts (mang ngoai co the cham) chan su kien load.
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type=email]', ACCOUNTS[who][0]);
  await page.fill('input[autocomplete=current-password]', ACCOUNTS[who][1]);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
}

// Gateway gioi han 100 request/60s cho moi cap (to chuc, IP) - moi trang goi ~5-10 API nen kich
// ban nghi giua cac trang va dem so phan hoi 429 de bao cao rieng.
let rateLimited = 0;
(async () => {
  const browser = await chromium.launch();
  let restore = null;
  try {
    for (const who of Object.keys(PAGES)) {
      const ctx = await browser.newContext({ locale: 'vi-VN' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
      page.on('response', (r) => {
        if (!r.url().includes('/api/')) return;
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
        if (r.status() === 429) rateLimited++;
      });
      await login(page, who);
      for (const p of PAGES[who]) {
        const before = errors.length;
        await page.goto(`${WEB}${p}`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        check(`${who} mo ${p}`, errors.length === before && !page.url().includes('/login'), errors.slice(before).join(' | '));
      }
      await ctx.close();
    }

    console.log(`so phan hoi 429 (rate-limit) khi duyet trang: ${rateLimited}`);
    // Ma tran phan quyen - doi het cua so rate-limit neu vua bi 429
    if (rateLimited) await new Promise((r) => setTimeout(r, 60000));
    const roles = list((await api('admin', 'GET', '/roles')).data);
    const emp = roles.find((r) => r.name === 'Employee');
    restore = { id: emp.id, keys: [...emp.permissionKeys] };
    const ctx = await browser.newContext({ locale: 'vi-VN' });
    const page = await ctx.newPage();
    await login(page, 'admin');
    await page.goto(`${WEB}/admin/roles`, { waitUntil: 'domcontentloaded' });
    // Tim trong bang ma tran (tr) - sidebar co the co muc menu trung chu nhung bi an.
    const groupRow = (name) => page.locator('tr:visible', { hasText: name }).first();
    await groupRow('Sản phẩm & Kho').waitFor({ timeout: 20000 });
    check('nhom "Sản phẩm & Kho" hien thi', await groupRow('Sản phẩm & Kho').isVisible());
    check('nhom "Nhắn tin & Trợ lý AI" hien thi', await groupRow('Nhắn tin & Trợ lý AI').isVisible());
    check('khong con nhom "Khác"', (await page.locator('tr:visible', { hasText: /^\s*Khác\s*\d*\s*$/ }).count()) === 0);
    const box = page.getByRole('checkbox', { name: 'Employee - Sử dụng chatbot trợ lý nội bộ' });
    check('o chon chatbot:use cua Employee ton tai', (await box.count()) === 1);
    const wasOn = await box.isChecked();
    await box.click();
    await page.waitForTimeout(1500);
    const mid = list((await api('admin', 'GET', '/roles')).data).find((r) => r.id === emp.id).permissionKeys.includes('chatbot:use');
    check('bat/tat chatbot:use qua giao dien luu vao IAM', mid === !wasOn, `truoc=${wasOn} sau=${mid}`);
    await box.click();
    await page.waitForTimeout(1500);
    const after = list((await api('admin', 'GET', '/roles')).data).find((r) => r.id === emp.id).permissionKeys.includes('chatbot:use');
    check('bat/tat lan 2 tra ve trang thai ban dau', after === wasOn);
    await ctx.close();
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    if (restore) {
      const cur = list((await api('admin', 'GET', '/roles')).data).find((r) => r.id === restore.id);
      if (cur.permissionKeys.length !== restore.keys.length || !restore.keys.every((k) => cur.permissionKeys.includes(k))) {
        check('khoi phuc quyen Employee ban dau', (await api('admin', 'PATCH', `/roles/${restore.id}/permissions`, { permissionKeys: restore.keys })).status === 200);
      }
    }
    await browser.close();
    summary();
  }
})();
