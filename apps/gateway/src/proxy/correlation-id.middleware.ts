import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CORRELATION_ID_HEADER } from '@app/common-dto';

/**
 * Middleware DAU TIEN trong pipeline Gateway (setup-gateway.ts, chay TRUOC xac thuc JWT va
 * rate-limit) - gan 1 ma dinh danh duy nhat cho MOI request. Giai quyet gioi han da biet: truoc
 * day khong co cach nao tra cuu 1 request bi loi xuyen qua nhieu service (Gateway -> service
 * nghiep vu) ma khong doi chieu timestamp thu cong giua cac log rieng le.
 *
 * Neu client da tu gui san header nay (vd cong cu debug/tich hop giam sat sau nay) thi GIU
 * NGUYEN gia tri do thay vi ghi de - cho phep tracing tu ben ngoai Gateway khi can. Ghi THANG vao
 * req.headers (thay vi 1 thuoc tinh rieng tren req, vd req.correlationId) de MOI noi doc header
 * binh thuong deu thay duoc gia tri nay ma khong can mo rong kieu Request: injectAuthHeaders()
 * (forward sang downstream), AllExceptionsFilter (@app/common-guard, o tung service phia sau ghi
 * log + tra ve trong body loi), va cac diem sendErrorResponse() ngay tai Gateway.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[CORRELATION_ID_HEADER];
  const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
  req.headers[CORRELATION_ID_HEADER] = id;
  res.setHeader(CORRELATION_ID_HEADER, id);
  next();
}
