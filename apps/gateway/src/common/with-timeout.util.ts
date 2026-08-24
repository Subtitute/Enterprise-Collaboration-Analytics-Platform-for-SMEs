// 22/08/2026: tach ra tu withTimeout() cuc bo truoc day chi nam trong
// rate-limit.middleware.ts - phat hien qua rieng ra soat: CUNG 1 lop loi (ioredis
// enableOfflineQueue mac dinh true -> lenh Redis "treo" vo thoi han khi mat ket noi thay vi tu
// choi ngay) cung xay ra o jwt-auth.middleware.ts (kiem tra JWT blacklist, chay tren MOI request
// da xac thuc) nhung chua duoc boc timeout - fix truoc day (rate-limit.middleware.ts) khong duoc
// ap dung dung o day vi khong co 1 noi dung chung de ca 2 file cung dung. Chuyen ve day de 2 noi
// goi Redis cua Gateway (rate-limit + JWT blacklist) dung chung 1 cai dat da kiem chung, tranh lap
// lai dung sai lam da khien fix truoc chi vao 1 noi.
export function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage ?? `Vuot qua ${ms}ms`)), ms);
    // unref() - timer nay khong duoc giu tien trinh Node song neu no la viec con lai duy nhat.
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}
