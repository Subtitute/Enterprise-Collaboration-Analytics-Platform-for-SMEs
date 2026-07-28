# E2E (Playwright)

Bo kiem thu end-to-end chay tren trinh duyet Chromium that, nham thang vao container `web` (SPA + Nginx proxy) cua stack Docker dang chay - khac voi cac test Jest o tung service (unit/integration, chay tren DB test rieng, khong can trinh duyet).

## Dieu kien tien quyet

1. Toan bo stack dang chay va healthy: `docker compose -f ../infra/docker-compose.yml --env-file ../infra/.env up -d`
2. Da seed du lieu demo it nhat 1 lan (cac test dung lai tai khoan Org Admin `admin@demo-sme.vn`): `npm run seed` (chay o thu muc goc repo).

## Chay test

```bash
npm install          # 1 lan, cai @playwright/test
npx playwright install chromium --with-deps   # 1 lan, tai trinh duyet Chromium cho Playwright
npm run test:e2e            # chay toan bo
npm run test:e2e:ui         # che do UI truc quan, hop khi debug tung buoc
npm run test:e2e:report     # mo lai bao cao HTML cua lan chay gan nhat
```

Mac dinh nham vao `http://localhost` (cong host cua container `web`). Doi bang bien moi truong `E2E_BASE_URL` neu can (vd chay Playwright tu may khac, hoac nham vao `vite preview`).

## Pham vi va gioi han co chu dich

- Cac test **khong don dep du lieu da tao** (du an/cong viec/tep/thanh vien duoc moi qua cac flow) - moi test tu dat ten/email duy nhat (ham `uniqueName()`/timestamp trong `tests/helpers.ts`) de khong trung lap giua cac lan chay, nhung du lieu se tich luy dan trong to chuc demo qua thoi gian. Chap nhan duoc vi day la moi truong demo/do an, khong phai production - don gian hoa dang ke so voi xay dung co che don dep/rollback day du.
- Chi bao phu **luong vang** (golden path) cua tung module, khong phai moi nhanh loi/canh bien - muc tieu la mang luoi bat regression cho cac luong nguoi dung chinh, khong thay the cho unit/integration test da co o tung service.
- Chua tich hop vao pipeline CI (`Technical_Spec.md` muc 11) vi CI hien tai khong dung stack Docker day du (khong co moi truong staging) - chay thu cong hoac tu may phat trien co stack dang bat.
