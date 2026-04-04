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
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '@zentry/types';
import { UserRole } from '@zentry/types';
import {
  RegisterIndividualDto,
  RegisterCyberCafeDto,
  RegisterCbtDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
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

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
  ): void {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: this.parseDurationToMs(
        this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      ),
    });
  }

  private clearRefreshTokenCookie(response: Response): void {
    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  // ── Registration ──────────────────────────────────────────────

  @Public()
  @Post('register/individual')
  registerIndividual(@Body() dto: RegisterIndividualDto) {
    return this.authService.registerIndividual(dto);
  }

  @Public()
  @Post('register/cyber-cafe')
  registerCyberCafe(@Body() dto: RegisterCyberCafeDto) {
    return this.authService.registerCyberCafe(dto);
  }

  @Public()
  @Post('register/cbt')
  registerCbt(@Body() dto: RegisterCbtDto) {
    return this.authService.registerCbt(dto);
  }

  // ── OTP & Verification ────────────────────────────────────────

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyEmail(dto.email, dto.otp);
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
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email);
  }

  // ── Login / Logout ────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress;
    const result = await this.authService.login(dto.email, dto.password, ip);
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
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
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

  // ── PIN ───────────────────────────────────────────────────────

  @Post('set-pin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.INDIVIDUAL, UserRole.CYBER_CAFE, UserRole.CBT_CENTER)
  setPin(@CurrentUser() user: JwtUser, @Body() dto: SetPinDto) {
    return this.authService.setPin(user.sub, dto.pin, dto.confirmPin);
  }

  @Post('change-pin')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.INDIVIDUAL, UserRole.CYBER_CAFE, UserRole.CBT_CENTER)
  changePin(@CurrentUser() user: JwtUser, @Body() dto: ChangePinDto) {
    return this.authService.changePin(
      user.sub,
      dto.currentPin,
      dto.newPin,
      dto.confirmPin,
    );
  }
}
