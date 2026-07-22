// 22/07/2026: tach rieng file nay de gop 1 noi duy nhat 2 hang so truoc day bi khai bao
// lap y het nhau o packages/common-guard/src/guards/internal-auth.guard.ts VA
// apps/gateway/src/proxy/inject-auth-headers.ts - phat hien qua code review toan du an: neu
// sau nay can doi ten header hoac gia tri fallback, sua sot 1 file se de bi lech voi ban con
// lai (vi du: chi sua 1 noi -> Gateway ky bang gia tri cu, service phia sau doi hoi gia tri moi
// -> MOI request bi tu choi 401 hang loat). @app/common-dto la package duy nhat ca Gateway lan
// @app/common-guard deu da phu thuoc san nen la noi hop ly de dat hang so dung chung nay.

/** Ten header mang bi mat chia se giua Gateway va cac service phia sau (Technical_Spec.md muc 6). */
export const INTERNAL_SHARED_SECRET_HEADER = 'x-internal-secret';

/**
 * Gia tri fallback CHI DANH CHO DEV khi bien moi truong INTERNAL_SHARED_SECRET chua duoc
 * thiet lap. Gia tri nay xuat hien cong khai trong ma nguon (git) nen KHONG duoc phep dung
 * trong production - xem cach kiem tra/chan tai:
 *   - packages/common-guard/src/guards/internal-auth.guard.ts (service phia sau)
 *   - apps/gateway/src/proxy/inject-auth-headers.ts (Gateway)
 */
export const DEV_FALLBACK_INTERNAL_SHARED_SECRET = 'dev-shared-secret-change-me';
