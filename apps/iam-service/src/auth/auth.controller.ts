import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@app/common-guard';
import { AuthContext } from '@app/common-dto';
import { AuthService } from './auth.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

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
    secure: false,
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
      throw new UnauthorizedException('Thieu refresh token, vui long dang nhap lai');
    }
    const { refreshToken, ...rest } = await this.authService.refresh(refreshTokenValue);
    setRefreshTokenCookie(res, refreshToken);
    return rest;
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(dto.refreshToken);
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_TOKEN_COOKIE_PATH });
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthContext) {
    return user;
  }
}
