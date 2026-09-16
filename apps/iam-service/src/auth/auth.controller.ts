import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@app/common-guard';
import { AuthContext, ERROR_CODES } from '@app/common-dto';
import { AuthService } from './auth.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * Refresh token khong con tra ve trong JSON body - duoc set qua httpOnly cookie de chong
 * XSS doc cap token (Wireframe.md muc 1, Technical_Spec.md muc 6, bo sung 21/07/2026).
 * `path` gioi han cookie chi duoc trinh duyet gui kem cho cac request toi /api/v1/auth/*
 * (vd /auth/refresh, /auth/logout), khong bi gui thua cho cac API nghiep vu khac.
 */
const REFRESH_TOKEN_COOKIE = 'ecap_refresh_token';
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngay - khop JWT_REFRESH_EXPIRES_IN mac dinh

function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    // 22/07/2026: truoc day hardcode `secure: false` nen cookie van duoc trinh duyet gui qua ca
    // ket noi HTTP thuong o production - suy dien tu NODE_ENV thay vi hang so cung, giong cach
    // Technical_Spec.md muc 9 yeu cau cookie nhay cam phai `Secure` khi chay that (HTTPS qua Gateway).
    // Dev/test (NODE_ENV != 'production') van chay duoc qua HTTP thuong tren localhost.
    secure: process.env.NODE_ENV === 'production',
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register-organization')
  async registerOrganization(
    @Body() dto: RegisterOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.registerOrganization(dto);
    setRefreshTokenCookie(res, refreshToken);
    return rest;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...rest } = await this.authService.login(dto);
    setRefreshTokenCookie(res, refreshToken);
    return rest;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!refreshTokenValue) {
      throw new UnauthorizedException({
        message: 'Thieu refresh token, vui long dang nhap lai',
        errorCode: ERROR_CODES.MISSING_REFRESH_TOKEN,
      });
    }
    const { refreshToken, ...rest } = await this.authService.refresh(refreshTokenValue);
    setRefreshTokenCookie(res, refreshToken);
    return rest;
  }

  // 22/07/2026: truoc day doc refresh token tu @Body() RefreshTokenDto, nhung tu khi refresh token
  // chuyen sang httpOnly cookie (21/07/2026, xem chu thich dau file) frontend KHONG con nam giu
  // token that de gui trong body - no gui 1 chuoi placeholder khong bi mat, verifyAsync() trong
  // authService.logout() luon that bai voi chuoi do, bi catch nuot loi va coi nhu "da dang xuat"
  // MA KHONG BAO GIO goi toi revokeRefreshToken() -> phien dang nhap khong bao gio thuc su bi thu
  // hoi, ke ca khi nguoi dung chu dong bam "Dang xuat" (loi CRITICAL, review 22/07/2026). Doc dung
  // tu httpOnly cookie giong het refresh() o tren. Neu khong co cookie (da dang xuat/het cookie tu
  // truoc) thi coi nhu da dang xuat, van xoa cookie va tra 204 nhu binh thuong, khong goi service.
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (refreshTokenValue) {
      await this.authService.logout(refreshTokenValue);
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_TOKEN_COOKIE_PATH });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthContext) {
    return user;
  }
}
