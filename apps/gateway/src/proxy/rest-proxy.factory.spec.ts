// 25/07/2026: file test moi - phat hien qua code review toan du an: handler 'error' cua
// createServiceProxy() (bo sung 22/07/2026 de tra 502 dung dinh dang ErrorResponseDto thay vi
// de http-proxy-middleware roi ve trang loi plain-text mac dinh cua thu vien) truoc day CHUA co
// test nao. Mock module 'http-proxy-middleware' de "bat" truc tiep ham on.error duoc truyen vao
// createProxyMiddleware() luc khoi tao proxy, roi goi thang ham do de mo phong su kien 'error'
// ma khong can dung mot upstream/downstream that.
import type { IncomingMessage, ServerResponse } from 'http';
import type { Socket } from 'net';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServiceProxy } from './rest-proxy.factory';

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => jest.fn()),
}));

type ProxyErrorHandler = (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => void;

function captureErrorHandler(): ProxyErrorHandler {
  createServiceProxy(['/api/v1/foo'], 'http://foo-service:3000');
  const mockCreateProxyMiddleware = createProxyMiddleware as unknown as jest.Mock;
  const lastCallOptions = mockCreateProxyMiddleware.mock.calls[mockCreateProxyMiddleware.mock.calls.length - 1][0];
  return lastCallOptions.on.error;
}

function createServerResponseLike(headersSent: boolean) {
  return {
    headersSent,
    writeHead: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('createServiceProxy - on.error handler', () => {
  beforeEach(() => {
    (createProxyMiddleware as unknown as jest.Mock).mockClear();
  });

  it('tra ve 502 dung dinh dang ErrorResponseDto khi proxy phat sinh loi ket noi toi downstream', () => {
    const errorHandler = captureErrorHandler();
    const res = createServerResponseLike(false);
    const req = { url: '/api/v1/foo/bar' } as IncomingMessage;

    errorHandler(new Error('ECONNREFUSED'), req, res as unknown as ServerResponse);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        error: 'BadGatewayException',
        message: expect.any(String),
        path: '/api/v1/foo/bar',
      }),
    );
  });

  it('no-op (khong ghi response) khi res.headersSent da la true (proxy loi SAU khi da bat dau stream)', () => {
    const errorHandler = captureErrorHandler();
    const res = createServerResponseLike(true);
    const req = { url: '/api/v1/foo/bar' } as IncomingMessage;

    errorHandler(new Error('ECONNRESET'), req, res as unknown as ServerResponse);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('no-op khi res la net.Socket (khong co writeHead - truong hop WS upgrade, khong ap dung o proxy REST)', () => {
    const errorHandler = captureErrorHandler();
    const socket = { destroy: jest.fn() } as unknown as Socket;
    const req = { url: '/api/v1/foo/bar' } as IncomingMessage;

    expect(() => errorHandler(new Error('ECONNRESET'), req, socket)).not.toThrow();
  });
});

// 03/10/2026: test moi - phat hien qua rieng soat: `createServiceProxy()` truoc day luon dung 1
// PROXY_TIMEOUT_MS=30s CUNG cho MOI route, qua gat gao voi tai file lon/bao cao ML nang. Bo sung
// tham so `timeoutMs` tuy chon - xac nhan gia tri mac dinh khong doi khi khong truyen, va gia tri
// tuy chinh duoc truyen dung xuong `proxyTimeout`/`timeout` cua http-proxy-middleware.
describe('createServiceProxy - timeoutMs', () => {
  beforeEach(() => {
    (createProxyMiddleware as unknown as jest.Mock).mockClear();
  });

  function lastProxyOptions(): { proxyTimeout: number; timeout: number } {
    const mockCreateProxyMiddleware = createProxyMiddleware as unknown as jest.Mock;
    return mockCreateProxyMiddleware.mock.calls[mockCreateProxyMiddleware.mock.calls.length - 1][0];
  }

  it('mac dinh 30_000ms khi khong truyen timeoutMs (giu nguyen hanh vi cu)', () => {
    createServiceProxy(['/api/v1/foo'], 'http://foo-service:3000');
    const options = lastProxyOptions();

    expect(options.proxyTimeout).toBe(30_000);
    expect(options.timeout).toBe(30_000);
  });

  it('dung dung gia tri tuy chinh khi co truyen timeoutMs (vd route tai file lon/ML)', () => {
    createServiceProxy(['/api/v1/files'], 'http://document-service:3000', 120_000);
    const options = lastProxyOptions();

    expect(options.proxyTimeout).toBe(120_000);
    expect(options.timeout).toBe(120_000);
  });
});
