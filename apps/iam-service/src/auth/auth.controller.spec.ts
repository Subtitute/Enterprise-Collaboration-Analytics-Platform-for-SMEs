import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * 22/07/2026: unit test toi thieu cho logout() - review truoc do phat hien day la loi CRITICAL
 * (xem chu thich chi tiet tren logout() trong auth.controller.ts) ma KHONG co bat ky test nao
 * bao ve, vi truoc day logout() nhan token qua @Body() RefreshTokenDto thay vi doc tu httpOnly
 * cookie (giong het refresh()) nen tren thuc te LUON goi authService.logout() voi 1 chuoi
 * placeholder khong bi mat do frontend gui len (frontend khong nam giu refresh token that) - loi
 * do lam session KHONG BAO GIO thuc su bi thu hoi khi nguoi dung bam "Dang xuat". Test nay khoa
 * chat hop dong "logout() phai doc tu req.cookies, khong doc tu request body" bang cach kiem tra
 * chinh xac gia tri duoc truyen cho authService.logout() phai la gia tri cookie, khong phai gia
 * tri nao khac. Bai e2e day du hon (dang nhap that -> dang xuat -> replay cookie cu vao
 * /auth/refresh -> ky vong 401) nam o apps/iam-service/test/app.e2e-spec.ts vi can ha tang that
 * (DB/Kafka/Redis) - xem chu thich dau file do.
 */
describe('AuthController.logout() - doc refresh token tu httpOnly cookie (Fix 1, review 22/07/2026)', () => {
  // Phai khop REFRESH_TOKEN_COOKIE trong auth.controller.ts (khong export nen lap lai o day,
  // cung cach app.e2e-spec.ts da lam).
  const REFRESH_TOKEN_COOKIE = 'ecap_refresh_token';
  const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

  let controller: AuthController;
  let authServiceMock: { logout: jest.Mock };
  let resMock: { clearCookie: jest.Mock };

  beforeEach(() => {
    authServiceMock = { logout: jest.fn().mockResolvedValue(undefined) };
    resMock = { clearCookie: jest.fn() };
    controller = new AuthController(authServiceMock as unknown as AuthService);
  });

  it('goi authService.logout() voi DUNG gia tri tu req.cookies, khong phai tu body', async () => {
    const req = {
      cookies: { [REFRESH_TOKEN_COOKIE]: 'gia-tri-that-cua-cookie-httponly' },
    } as unknown as Request;

    await controller.logout(req, resMock as unknown as Response);

    expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
    expect(authServiceMock.logout).toHaveBeenCalledWith('gia-tri-that-cua-cookie-httponly');
    expect(resMock.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, {
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  });

  it('khi khong co cookie (da dang xuat/het cookie tu truoc) thi KHONG goi authService.logout(), van xoa cookie va khong nem loi', async () => {
    const req = { cookies: {} } as unknown as Request;

    await expect(controller.logout(req, resMock as unknown as Response)).resolves.toBeUndefined();

    expect(authServiceMock.logout).not.toHaveBeenCalled();
    expect(resMock.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, {
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  });
});
