import type { IncomingMessage, ServerResponse } from 'http';
import type { Socket } from 'net';
import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ERROR_CODES } from '@app/common-dto';
import { sendErrorResponse } from '../common/send-error-response';
import { injectAuthHeaders } from './inject-auth-headers';
import { matchesPrefix } from './path-match.util';

const logger = new Logger('RestProxy');

/**
 * Tao proxy cho mot nhom tien to REST (vd /api/v1/auth, /api/v1/users, ...) toi 1 target.
 *
 * Mount tai goc (app.use(proxy), KHONG app.use(prefix, proxy)) va tu loc duong dan bang
 * pathFilter dang ham - vi Express se cat bo doan prefix khoi req.url khi mount theo path,
 * pha vo tinh chat "path-preserving" cua proxy (downstream can nguyen /api/v1/... trong URL).
 */
// 22/08/2026: phat hien qua rieng ra soat - truoc day KHONG dat proxyTimeout/timeout, chi co
// handler 'error' (ban tren) von CHI bat loi cap ket noi (vd downstream tu choi ket noi ngay).
// Neu downstream NHAN ket noi TCP roi khong bao gio phan hoi (deadlock, row lock Postgres bi khoa
// vinh vien...), request cua client se "treo" vo thoi han - handler 'error' khong bao gio chay vi
// khong co loi cap ket noi nao xay ra, chi la khong ai tra loi. Dat tran thoi gian de Gateway LUON
// tra loi (thanh cong hoac 504-tuong-duong qua handler 'error' o tren, http-proxy-middleware tu
// phat 'error' voi ECONNRESET khi vuot proxyTimeout) thay vi treo mai theo downstream.
const PROXY_TIMEOUT_MS = 30_000;

export function createServiceProxy(prefixes: string[], target: string): ReturnType<typeof createProxyMiddleware> {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
    pathFilter: (pathname) => matchesPrefix(pathname, prefixes),
    on: {
      proxyReq: injectAuthHeaders,
      // 22/07/2026: bo sung handler 'error' - phat hien qua code review toan du an: truoc day
      // khong dang ky, nen khi downstream service khong ket noi duoc (crash, chua khoi dong
      // xong, timeout, ...) http-proxy-middleware roi ve handler mac dinh cua thu vien, tra ve
      // plain text ("Error occurred while trying to proxy...") thay vi dung dinh dang loi chuan
      // ErrorResponseDto ({statusCode, error, message, timestamp}) ma toan bo API con lai dung
      // (xem send-error-response.ts) - frontend parse JSON that bai/hien thi loi ky la cho nguoi
      // dung. `res` co the la http.ServerResponse (REST, truong hop nay) hoac net.Socket (WS
      // upgrade, khong ap dung o proxy REST nay) theo type cua http-proxy - kiem tra 'writeHead'
      // de chi xu ly truong hop ServerResponse va bo qua neu header da gui (proxy co the loi
      // SAU khi da bat dau stream response).
      //
      // Khai bao tuong minh kieu (err/req/res) thay vi de TypeScript tu suy luan tu generic cua
      // createProxyMiddleware() - vi khong co doi so nao khac trong lan goi nay co the "chot"
      // duoc TReq/TRes, trinh bien dich suy luan sai thanh `unknown` cho res (thay vi dung
      // default ServerResponse) khien 'writeHead' in res / res.headersSent khong bien dich duoc.
      error: (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => {
        logger.warn(`Proxy REST toi ${target} that bai cho ${req.url ?? ''}: ${err.message}`);
        if ('writeHead' in res && !res.headersSent) {
          sendErrorResponse(
            res as unknown as Response,
            502,
            'BadGatewayException',
            'Khong the ket noi toi dich vu, vui long thu lai sau',
            req.url,
            ERROR_CODES.GATEWAY_PROXY_FAILED,
            req,
          );
        }
      },
    },
  });
}
