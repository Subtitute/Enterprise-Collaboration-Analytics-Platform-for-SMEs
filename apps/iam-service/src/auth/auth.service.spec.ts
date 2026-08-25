import * as bcrypt from 'bcryptjs';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';
import { AuthService, parseDurationMs } from './auth.service';
import type { LoginDto } from './dto/login.dto';

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
      {} as never, // outboxService - khong dung trong login()
      {} as never, // rolesService - khong dung trong login()
      jwtService as never,
      configService as never,
      redisService as never,
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
