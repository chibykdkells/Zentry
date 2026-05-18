import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import type { Request, Response } from 'express';
import type { Tenant } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { TenantContext } from '../../common/decorators/tenant-context.decorator';
import { RequiresTenant } from '../../common/decorators/requires-tenant.decorator';
import type { JwtUser } from '@zendocx/types';
import { UserRole } from '@zendocx/types';
import {
  RegisterIndividualDto,
  RegisterCbtDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  SetPinDto,
  ChangePinDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private parseCookieHeader(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) {
      return {};
    }

    return cookieHeader
      .split(';')
      .map((cookiePart) => cookiePart.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((accumulator, cookiePart) => {
        const separatorIndex = cookiePart.indexOf('=');

        if (separatorIndex === -1) {
          return accumulator;
        }

        const key = cookiePart.slice(0, separatorIndex).trim();
        const value = cookiePart.slice(separatorIndex + 1).trim();
        accumulator[key] = decodeURIComponent(value);
        return accumulator;
      }, {});
  }

  private parseDurationToMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private getRefreshCookieDomain(): string | undefined {
    const explicitDomain = this.configService
      .get<string>('COOKIE_DOMAIN')
      ?.trim();
    if (explicitDomain) {
      return explicitDomain.startsWith('.')
        ? explicitDomain
        : `.${explicitDomain}`;
    }

    const configuredUrl =
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      this.configService.get<string>('API_URL')?.trim() ||
      '';

    if (!configuredUrl) {
      return undefined;
    }

    try {
      const hostname = new URL(configuredUrl).hostname.toLowerCase();
      const segments = hostname.split('.').filter(Boolean);

      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
        segments.length < 2
      ) {
        return undefined;
      }

      return `.${segments.slice(-2).join('.')}`;
    } catch {
      return undefined;
    }
  }

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    response.cookie('refresh_token', refreshToken, {
      domain: this.getRefreshCookieDomain(),
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: this.getRefreshCookieSameSite(),
      path: '/',
      maxAge: this.parseDurationToMs(
        this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      ),
    });
  }

  private getRefreshCookieSameSite(): CookieOptions['sameSite'] {
    return this.configService.get('NODE_ENV') === 'production'
      ? 'none'
      : 'lax';
  }

  private clearRefreshTokenCookie(response: Response): void {
    response.clearCookie('refresh_token', {
      domain: this.getRefreshCookieDomain(),
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: this.getRefreshCookieSameSite(),
      path: '/',
    });
  }

  // ── Registration ──────────────────────────────────────────────

  @Public()
  @RequiresTenant()
  @Post('register/individual')
  @Audit({
    action: 'USER_REGISTERED',
    entity: 'User',
    lookup: 'response_user',
    mergeExisting: true,
    captureRequestFields: ['email'],
  })
  registerIndividual(
    @Body() dto: RegisterIndividualDto,
    @TenantContext() tenant: Tenant,
  ) {
    return this.authService.registerIndividual(dto, tenant.id);
  }

  @Public()
  @RequiresTenant()
  @Post('register/cbt')
  @Audit({
    action: 'USER_REGISTERED',
    entity: 'User',
    lookup: 'response_user',
    mergeExisting: true,
    captureRequestFields: ['email'],
  })
  registerCbt(@Body() dto: RegisterCbtDto, @TenantContext() tenant: Tenant) {
    return this.authService.registerCbt(dto, tenant.id);
  }

  // ── OTP & Verification ────────────────────────────────────────

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: 'EMAIL_VERIFIED',
    entity: 'User',
    lookup: 'body_email',
    mergeExisting: true,
    captureRequestFields: ['email'],
  })
  async verifyEmail(
    @Body() dto: VerifyOtpDto,
    @TenantContext() tenant: Tenant | null,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyEmail(
      dto.email,
      dto.otp,
      tenant?.id ?? null,
    );
    this.setRefreshTokenCookie(response, result.data.refreshToken);

    return {
      message: result.message,
      data: {
        accessToken: result.data.accessToken,
        role: result.data.role,
      },
    };
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour
  @Audit({
    action: 'OTP_RESENT',
    entity: 'User',
    lookup: 'body_email',
    captureRequestFields: ['email'],
  })
  resendOtp(@Body() dto: ResendOtpDto, @TenantContext() tenant: Tenant | null) {
    return this.authService.resendOtp(dto.email, tenant?.id ?? null);
  }

  // ── Login / Logout ────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: 'USER_LOGIN',
    entity: 'User',
    lookup: 'response_user',
    mergeExisting: true,
    captureRequestFields: ['email'],
  })
  async login(
    @Body() dto: LoginDto,
    @TenantContext() tenant: Tenant | null,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress;
    const result = await this.authService.login(
      dto.email,
      dto.password,
      tenant?.id ?? null,
      ip,
    );
    this.setRefreshTokenCookie(response, result.data.refreshToken);

    return {
      message: result.message,
      data: {
        accessToken: result.data.accessToken,
        user: result.data.user,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: 'USER_LOGOUT',
    entity: 'User',
    lookup: 'current_user',
    mergeExisting: true,
  })
  async logout(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.clearRefreshTokenCookie(response);
    return this.authService.logout(user.sub);
  }

  // ── Token refresh ─────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = this.parseCookieHeader(req.headers.cookie);
    const token = cookies['refresh_token'] ?? '';
    const result = await this.authService.refreshTokens(token);
    this.setRefreshTokenCookie(response, result.data.refreshToken);

    return {
      message: result.message,
      data: {
        accessToken: result.data.accessToken,
      },
    };
  }

  // ── Profile ───────────────────────────────────────────────────

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.authService.getMe(user.sub);
  }

  // ── Password reset ────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour
  @Audit({
    action: 'PASSWORD_RESET_REQUESTED',
    entity: 'User',
    lookup: 'body_email',
    captureRequestFields: ['email'],
  })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @TenantContext() tenant: Tenant | null,
  ) {
    return this.authService.forgotPassword(dto.email, tenant?.id ?? null);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(
      dto.token,
      dto.password,
      dto.confirmPassword,
    );
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.INDIVIDUAL,
    UserRole.CBT_CENTER,
    UserRole.TENANT_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @Audit({
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    lookup: 'current_user',
    mergeExisting: true,
  })
  async changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
    this.setRefreshTokenCookie(response, result.data.refreshToken);

    return {
      message: result.message,
      data: {
        accessToken: result.data.accessToken,
      },
    };
  }

  // ── PIN ───────────────────────────────────────────────────────

  @Post('set-pin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.INDIVIDUAL, UserRole.CBT_CENTER, UserRole.TENANT_ADMIN)
  @Audit({
    action: 'PIN_SET',
    entity: 'User',
    lookup: 'current_user',
    mergeExisting: true,
  })
  setPin(@CurrentUser() user: JwtUser, @Body() dto: SetPinDto) {
    return this.authService.setPin(user.sub, dto.pin, dto.confirmPin);
  }

  @Post('change-pin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.INDIVIDUAL, UserRole.CBT_CENTER, UserRole.TENANT_ADMIN)
  @Audit({
    action: 'PIN_CHANGED',
    entity: 'User',
    lookup: 'current_user',
    mergeExisting: true,
  })
  changePin(@CurrentUser() user: JwtUser, @Body() dto: ChangePinDto) {
    return this.authService.changePin(
      user.sub,
      dto.currentPin,
      dto.newPin,
      dto.confirmPin,
    );
  }
}
