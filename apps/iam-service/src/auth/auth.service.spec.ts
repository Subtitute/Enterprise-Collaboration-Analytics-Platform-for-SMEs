import * as bcrypt from 'bcryptjs';
import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';
import { AuthService, parseDurationMs } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

describe('parseDurationMs', () => {
  it('quy doi "15m" thanh 15 phut (ms)', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
  });

  it('quy doi "7d" thanh 7 ngay (ms)', () => {
    expect(parseDurationMs('7d')).toBe(7 * 86_400_000);
  });

  it('quy doi "30s" thanh 30 giay (ms)', () => {
    expect(parseDurationMs('30s')).toBe(30_000);
  });

  it('tra ve mac dinh 7 ngay khi chuoi khong hop le', () => {
    expect(parseDurationMs('invalid')).toBe(7 * 86_400_000);
  });
});

/**
 * 22/08/2026: bo sung khi them chan brute-force dang nhap THEO TAI KHOAN (AuthService.login()) -
 * truoc do file nay chi test parseDurationMs(), toan bo login()/register()/refresh() chua co unit
 * test nao (phat hien qua ra soat coverage toan du an). Chi tap trung vao login() va hanh vi MOI -
 * khong co gang lam day du coverage lich su cho ca AuthService trong lan sua nay.
 */
describe('AuthService.login', () => {
  const email = 'user@demo-sme.vn';
  const rawPassword = 'Password123!';
  const passwordHash = bcrypt.hashSync(rawPassword, 4);

  function buildService(options: { attempts?: number; user?: unknown } = {}) {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(
        'user' in options
          ? options.user
          : { id: 'u1', email, isActive: true, passwordHash, organizationId: 'org1', roles: [] },
      ),
    };
    const refreshTokenRepo = {
      create: jest.fn((v: object) => v),
      save: jest.fn().mockResolvedValue({ id: 'rt1' }),
    };
    const redisService = {
      getFailedLoginAttempts: jest.fn().mockResolvedValue(options.attempts ?? 0),
      incrementFailedLoginAttempts: jest.fn().mockResolvedValue((options.attempts ?? 0) + 1),
      resetFailedLoginAttempts: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    const configService = {
      get: jest.fn((key: string) => (key === 'jwt.refreshExpiresIn' ? '7d' : 'dummy')),
    };
    const service = new AuthService(
      {} as never, // dataSource - khong dung trong login()
      userRepo as never,
      refreshTokenRepo as never,
      {} as never, // passwordResetTokenRepo - khong dung trong login()
      {} as never, // outboxService - khong dung trong login()
      {} as never, // rolesService - khong dung trong login()
      jwtService as never,
      configService as never,
      redisService as never,
      {} as never, // emailService - khong dung trong login()
    );
    return { service, userRepo, redisService };
  }

  it('dang nhap thanh cong: xoa bo dem loi (khong de nguoi dung hop le bi khoa oan vi lan go nham truoc do)', async () => {
    const { service, redisService } = buildService();
    const result = await service.login({ email, password: rawPassword } as LoginDto);
    expect(result.user.email).toBe(email);
    expect(redisService.resetFailedLoginAttempts).toHaveBeenCalledWith(email);
    expect(redisService.incrementFailedLoginAttempts).not.toHaveBeenCalled();
  });

  // 25/08/2026: fix code review (phat hien qua dot ra soat bao mat lan 3) - truoc ban sua nay,
  // userRepo.findOne() dung `dto.email` THO (chua chuan hoa) de tra cuu tai khoan, chi rieng
  // `emailKey` (bo dem throttle) moi duoc chuan hoa - 1 nguoi dung go hoa dau email (vd trinh
  // duyet tu viet hoa) se KHONG tim thay chinh tai khoan cua ho du dung mat khau.
  it('dang nhap thanh cong voi email VIET HOA khac ban da luu (chuan hoa truoc khi tra cuu)', async () => {
    const { service, userRepo } = buildService();
    const result = await service.login({ email: 'User@Demo-SME.vn', password: rawPassword } as LoginDto);

    expect(result.user.email).toBe(email);
    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email } });
  });

  it('sai mat khau: tang bo dem loi, van nem UnauthorizedException/INVALID_CREDENTIALS nhu truoc', async () => {
    const { service, redisService } = buildService();
    await expect(service.login({ email, password: 'sai-mat-khau' } as LoginDto)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(redisService.incrementFailedLoginAttempts).toHaveBeenCalledWith(email, 15 * 60);
  });

  it('tai khoan khong ton tai: van tang bo dem (giu nguyen nhanh lam phang thoi gian phan hoi)', async () => {
    const { service, redisService, userRepo } = buildService({ user: null });
    await expect(service.login({ email, password: 'bat-ky' } as LoginDto)).rejects.toThrow(UnauthorizedException);
    expect(userRepo.findOne).toHaveBeenCalled();
    expect(redisService.incrementFailedLoginAttempts).toHaveBeenCalledWith(email, 15 * 60);
  });

  it('da vuot qua nguong (5 lan): tu choi NGAY voi 429/TOO_MANY_LOGIN_ATTEMPTS, KHONG truy van DB', async () => {
    const { service, redisService, userRepo } = buildService({ attempts: 5 });
    let caught: HttpException | undefined;
    try {
      await service.login({ email, password: 'bat-ky' } as LoginDto);
    } catch (err) {
      caught = err as HttpException;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect(caught?.getStatus()).toBe(429);
    expect((caught?.getResponse() as { errorCode: string }).errorCode).toBe(ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS);
    expect(userRepo.findOne).not.toHaveBeenCalled();
    expect(redisService.incrementFailedLoginAttempts).not.toHaveBeenCalled();
  });

  it('chuan hoa email ve chu thuong truoc khi dung lam khoa Redis (khong de "User@X" va "user@x" tinh la 2 tai khoan khac nhau)', async () => {
    const { service, redisService } = buildService();
    await service.login({ email: 'User@Demo-SME.vn', password: rawPassword } as LoginDto);
    expect(redisService.getFailedLoginAttempts).toHaveBeenCalledWith('user@demo-sme.vn');
  });
});

/**
 * 15/09/2026: "Quen mat khau" (phan hoi GVHD, muc 4) - forgotPassword() BAT BUOC luon tra ve thanh
 * cong chung chung (chong do email, xem chu thich trong AuthService), nen phai kiem tra ca 2 nhanh
 * "user ton tai" va "user KHONG ton tai/da bi vo hieu hoa" deu tra ve CUNG 1 ket qua tu ben ngoai,
 * chi khac nhau o cac side-effect noi bo (co/khong tao token + goi email).
 */
describe('AuthService.forgotPassword / resetPassword', () => {
  const email = 'user@demo-sme.vn';
  const userId = 'u1';

  function buildService(options: {
    user?: unknown;
    tokenRecord?: unknown;
    verifyResolvedValue?: unknown;
    verifyShouldReject?: boolean;
  } = {}) {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(
        'user' in options
          ? options.user
          : { id: userId, email, isActive: true, passwordHash: 'old-hash', organizationId: 'org1', roles: [] },
      ),
    };
    const passwordResetTokenRepo = {
      create: jest.fn((v: object) => v),
      save: jest.fn((v: object) => Promise.resolve({ ...v, id: 'prt1' })),
      findOne: jest.fn().mockResolvedValue(
        'tokenRecord' in options
          ? options.tokenRecord
          : { id: 'prt1', userId, usedAt: null, expiresAt: new Date(Date.now() + 60_000) },
      ),
    };
    const managerMock = {
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-reset-token'),
      verifyAsync: options.verifyShouldReject
        ? jest.fn().mockRejectedValue(new Error('invalid signature'))
        : jest.fn().mockResolvedValue(options.verifyResolvedValue ?? { sub: userId, tokenId: 'prt1' }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.resetExpiresIn') return '30m';
        if (key === 'frontendUrl') return 'http://localhost:5173';
        return 'dummy';
      }),
    };
    const emailService = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      dataSource as never,
      userRepo as never,
      {} as never, // refreshTokenRepo - resetPassword() thu hoi qua manager.delete(), khong dung repo nay truc tiep
      passwordResetTokenRepo as never,
      {} as never, // outboxService - khong dung trong forgotPassword()/resetPassword()
      {} as never, // rolesService - khong dung trong forgotPassword()/resetPassword()
      jwtService as never,
      configService as never,
      {} as never, // redisService - khong dung trong forgotPassword()/resetPassword()
      emailService as never,
    );
    return { service, userRepo, passwordResetTokenRepo, managerMock, dataSource, jwtService, emailService };
  }

  describe('forgotPassword', () => {
    it('user ton tai va active: tao PasswordResetToken, ky JWT, gui email chua link dat lai mat khau', async () => {
      const { service, passwordResetTokenRepo, emailService } = buildService();
      const result = await service.forgotPassword({ email } as ForgotPasswordDto);

      expect(result).toEqual({ success: true });
      expect(passwordResetTokenRepo.save).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        email,
        expect.stringContaining('http://localhost:5173/reset-password?token='),
      );
    });

    it('user KHONG ton tai: van tra ve thanh cong chung chung, KHONG tao token/KHONG goi email (chong do email)', async () => {
      const { service, passwordResetTokenRepo, emailService } = buildService({ user: null });
      const result = await service.forgotPassword({ email } as ForgotPasswordDto);

      expect(result).toEqual({ success: true });
      expect(passwordResetTokenRepo.save).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('user da bi vo hieu hoa: van tra ve thanh cong chung chung, KHONG tao token/KHONG goi email', async () => {
      const { service, passwordResetTokenRepo, emailService } = buildService({
        user: { id: userId, email, isActive: false, passwordHash: 'old-hash', organizationId: 'org1', roles: [] },
      });
      const result = await service.forgotPassword({ email } as ForgotPasswordDto);

      expect(result).toEqual({ success: true });
      expect(passwordResetTokenRepo.save).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('token hop le: cap nhat mat khau, danh dau usedAt, thu hoi toan bo RefreshToken cua user', async () => {
      const { service, managerMock } = buildService();
      const result = await service.resetPassword({
        token: 'valid-jwt',
        newPassword: 'MatKhauMoi123!',
      } as ResetPasswordDto);

      expect(result).toEqual({ success: true });
      // manager.save duoc goi 2 lan: 1 lan cho user (passwordHash moi), 1 lan cho tokenRecord (usedAt)
      expect(managerMock.save).toHaveBeenCalledTimes(2);
      expect(managerMock.delete).toHaveBeenCalledWith(expect.anything(), { userId });
    });

    it('JWT sai chu ky/het han: nem BadRequestException/PASSWORD_RESET_TOKEN_INVALID', async () => {
      const { service } = buildService({ verifyShouldReject: true });
      await expect(
        service.resetPassword({ token: 'bad-jwt', newPassword: 'MatKhauMoi123!' } as ResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('khong tim thay ban ghi PasswordResetToken tuong ung: nem PASSWORD_RESET_TOKEN_INVALID', async () => {
      const { service } = buildService({ tokenRecord: null });
      let caught: BadRequestException | undefined;
      try {
        await service.resetPassword({ token: 'valid-jwt', newPassword: 'MatKhauMoi123!' } as ResetPasswordDto);
      } catch (err) {
        caught = err as BadRequestException;
      }
      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught?.getResponse() as { errorCode: string }).errorCode).toBe(
        ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID,
      );
    });

    it('token DA DUNG roi (usedAt khac null): nem PASSWORD_RESET_TOKEN_INVALID', async () => {
      const { service } = buildService({
        tokenRecord: { id: 'prt1', userId, usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
      });
      await expect(
        service.resetPassword({ token: 'valid-jwt', newPassword: 'MatKhauMoi123!' } as ResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('token DA HET HAN (expiresAt trong qua khu): nem PASSWORD_RESET_TOKEN_INVALID', async () => {
      const { service } = buildService({
        tokenRecord: { id: 'prt1', userId, usedAt: null, expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(
        service.resetPassword({ token: 'valid-jwt', newPassword: 'MatKhauMoi123!' } as ResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('user gan voi token khong con ton tai/da bi vo hieu hoa: nem PASSWORD_RESET_TOKEN_INVALID', async () => {
      const { service } = buildService({ user: null });
      await expect(
        service.resetPassword({ token: 'valid-jwt', newPassword: 'MatKhauMoi123!' } as ResetPasswordDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
