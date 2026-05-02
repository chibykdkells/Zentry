import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  JwtUser,
  OtpType,
  TENANT_ADMIN_PERMISSIONS,
  TenantAdminPermission,
  UserRole,
} from '@zendocx/types';
import { generateTransactionRef } from '@zendocx/utils';
import { RegisterIndividualDto, RegisterCbtDto } from './dto';

@Injectable()
export class AuthService {
  private static readonly REFRESH_TOKEN_KEY_PREFIX = 'zendocx:auth:refresh';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private getEffectiveTenantAdminPermissions(
    value: Prisma.JsonValue | readonly string[] | null | undefined,
  ): TenantAdminPermission[] {
    const input = Array.isArray(value) ? value : [];
    const allowed = new Set<string>(TENANT_ADMIN_PERMISSIONS);
    const normalized = Array.from(
      new Set(
        input
          .map((item) => String(item).trim())
          .filter((item): item is TenantAdminPermission => allowed.has(item)),
      ),
    );

    return normalized.length ? normalized : [...TENANT_ADMIN_PERMISSIONS];
  }

  // ── Registration ──────────────────────────────────────────────

  async registerIndividual(dto: RegisterIndividualDto, tenantId: string) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    return this.createUser(dto, UserRole.INDIVIDUAL, tenantId);
  }

  async registerCbt(dto: RegisterCbtDto, tenantId: string) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const assignableCategoryIds = await this.getAssignableCbtServiceCategoryIds(
      tenantId,
    );
    const normalizedServiceCategoryIds = Array.from(
      new Set(dto.serviceCategoryIds.map((value) => value.trim()).filter(Boolean)),
    );

    if (!normalizedServiceCategoryIds.length) {
      throw new BadRequestException(
        'Select at least one service category your CBT can handle.',
      );
    }

    const invalidCategoryIds = normalizedServiceCategoryIds.filter(
      (categoryId) => !assignableCategoryIds.has(categoryId),
    );

    if (invalidCategoryIds.length) {
      throw new BadRequestException(
        'One or more selected service categories are no longer available for CBT registration.',
      );
    }

    const existingLicense = await this.prisma.cbtProfile.findUnique({
      where: { licenseNumber: dto.licenseNumber },
    });
    if (existingLicense) {
      throw new ConflictException(
        'A CBT center with this license number already exists',
      );
    }

    const result = await this.createUser(dto, UserRole.CBT_CENTER, tenantId);
    const user = result.data;
    await this.prisma.cbtProfile.create({
      data: {
        userId: user.id,
        tenantId,
        centerName: dto.centerName,
        licenseNumber: dto.licenseNumber,
        address: dto.address,
        state: dto.state,
        lga: dto.lga,
        serviceCategoryAssignments: {
          create: normalizedServiceCategoryIds.map((serviceCategoryId) => ({
            serviceCategoryId,
          })),
        },
      },
    });
    return result;
  }

  private async getAssignableCbtServiceCategoryIds(tenantId: string) {
    const categories = await this.prisma.serviceCategoryModel.findMany({
      where: {
        isActive: true,
        ...(tenantId
          ? {
              OR: [{ tenantId: null }, { tenantId }],
            }
          : { tenantId: null }),
        services: {
          some: {
            isActive: true,
            fulfillmentType: 'MANUAL',
            ...(tenantId
              ? {
                  OR: [{ tenantId: null }, { tenantId }],
                }
              : { tenantId: null }),
          },
        },
      },
      select: {
        id: true,
      },
    });

    return new Set(categories.map((category) => category.id));
  }

  private async createUser(
    dto: RegisterIndividualDto,
    role: UserRole,
    tenantId: string,
  ) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const normalizedPhone = dto.phone.trim();

    // Check uniqueness
    const [existingEmail, existingPhone] = await Promise.all([
      this.findUserByScopedEmail(normalizedEmail, tenantId),
      this.findUserByScopedPhone(normalizedPhone, tenantId),
    ]);

    if (existingEmail)
      throw new ConflictException('Email is already registered');
    if (existingPhone)
      throw new ConflictException('Phone number is already registered');

    const rounds = Number(this.config.get('BCRYPT_ROUNDS', '12'));
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    // Create user + wallet atomically
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          role,
          tenantId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
        },
      });

      await tx.wallet.create({ data: { userId: created.id } });

      await tx.auditLog.create({
        data: {
          userId: created.id,
          tenantId,
          action: 'USER_REGISTERED',
          entity: 'User',
          entityId: created.id,
          newValues: { role, email: created.email },
        },
      });

      return created;
    });

    // Send email OTP
    await this.sendEmailOtp(user.id, user.email);

    return {
      message:
        'Registration successful. Check your email for the verification OTP.',
      data: user,
    };
  }

  // ── OTP ───────────────────────────────────────────────────────

  private async sendEmailOtp(userId: string, email: string): Promise<void> {
    // Invalidate existing OTPs
    await this.prisma.otpToken.updateMany({
      where: { userId, type: OtpType.EMAIL_VERIFY, usedAt: null },
      data: { usedAt: new Date() },
    });

    const otp = randomInt(100000, 999999).toString();
    const rounds = Number(this.config.get('PIN_BCRYPT_ROUNDS', '10'));
    const hashed = await bcrypt.hash(otp, rounds);
    const expiryMinutes = Number(this.config.get('OTP_EXPIRY_MINUTES', '10'));

    await this.prisma.otpToken.create({
      data: {
        userId,
        token: hashed,
        type: OtpType.EMAIL_VERIFY,
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      },
    });

    // TODO Phase 8: inject EmailService and send real email
    // For now, log OTP in development only
    if (this.config.get('NODE_ENV') === 'development') {
      console.log(`[DEV OTP] ${email}: ${otp}`);
    }
  }

  async verifyEmail(email: string, otp: string, tenantId: string | null) {
    const user = await this.findUserByScopedEmail(email, tenantId);
    if (!user) throw new NotFoundException('User not found');
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const tokenRecord = await this.prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        type: OtpType.EMAIL_VERIFY,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }

    const maxAttempts = Number(this.config.get('MAX_OTP_ATTEMPTS', '5'));
    if (tokenRecord.attempts >= maxAttempts) {
      throw new BadRequestException(
        'Too many attempts. Please request a new OTP.',
      );
    }

    const isValid = await bcrypt.compare(otp, tokenRecord.token);
    if (!isValid) {
      await this.prisma.otpToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.$transaction([
      this.prisma.otpToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'EMAIL_VERIFIED',
          entity: 'User',
          entityId: user.id,
        },
      }),
    ]);

    const tokens = await this.issueSessionTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId ?? null,
    );
    return {
      message: 'Email verified successfully.',
      data: { ...tokens, role: user.role },
    };
  }

  async resendOtp(email: string, tenantId: string | null) {
    const user = await this.findUserByScopedEmail(email, tenantId);
    // Always return success to prevent email enumeration
    if (user && !user.isEmailVerified) {
      await this.sendEmailOtp(user.id, user.email);
    }
    return {
      message:
        'If this email exists and is unverified, a new OTP has been sent.',
    };
  }

  // ── Login ─────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    tenantId: string | null,
    ipAddress?: string,
  ) {
    const user = await this.findUserByScopedEmail(email, tenantId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Please verify your email before logging in.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress,
        },
      }),
    ]);

    const tokens = await this.issueSessionTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId ?? null,
    );
    return {
      message: 'Login successful.',
      data: {
        ...tokens,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId ?? null,
          isEmailVerified: user.isEmailVerified,
          adminPermissions:
            user.role === UserRole.TENANT_ADMIN
              ? this.getEffectiveTenantAdminPermissions(user.adminPermissions)
              : undefined,
        },
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        walletPin: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        lastLoginAt: true,
        createdAt: true,
        wallet: {
          select: {
            availableBalance: true,
            escrowBalance: true,
            totalEarned: true,
            totalWithdrawn: true,
          },
        },
        cbtProfile: {
          select: {
            centerName: true,
            approvalStatus: true,
            isOnline: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    const { walletPin, ...safeUser } = user;
    return {
      message: 'Profile retrieved',
      data: {
        ...safeUser,
        hasWalletPin: Boolean(walletPin),
      },
    };
  }

  // ── Password reset ────────────────────────────────────────────

  async forgotPassword(email: string, tenantId: string | null) {
    const user = await this.findUserByScopedEmail(email, tenantId);

    // Always return the same message — prevents email enumeration
    if (user) {
      const token = generateTransactionRef();
      const rounds = Number(this.config.get('PIN_BCRYPT_ROUNDS', '10'));
      const hashed = await bcrypt.hash(token, rounds);
      const expiryHours = Number(
        this.config.get('PASSWORD_RESET_EXPIRY_HOURS', '1'),
      );

      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: hashed,
          expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        },
      });

      // TODO Phase 8: send reset email with token link
      if (this.config.get('NODE_ENV') === 'development') {
        console.log(`[DEV RESET TOKEN] ${email}: ${token}`);
      }
    }

    return {
      message:
        'If this email is registered, a password reset link has been sent.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const resets = await this.prisma.passwordReset.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    let matchedReset: (typeof resets)[number] | null = null;
    for (const reset of resets) {
      const valid = await bcrypt.compare(token, reset.token);
      if (valid) {
        matchedReset = reset;
        break;
      }
    }

    if (!matchedReset) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const rounds = Number(this.config.get('BCRYPT_ROUNDS', '12'));
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: matchedReset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: matchedReset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: matchedReset.userId,
          action: 'PASSWORD_RESET',
          entity: 'User',
          entityId: matchedReset.userId,
        },
      }),
    ]);

    await this.deleteRefreshToken(matchedReset.userId);

    return { message: 'Password reset successful. Please log in.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const currentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const rounds = Number(this.config.get('BCRYPT_ROUNDS', '12'));
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId ?? undefined,
          action: 'PASSWORD_CHANGED',
          entity: 'User',
          entityId: user.id,
        },
      }),
    ]);

    const tokens = await this.issueSessionTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId ?? null,
    );

    return {
      message: 'Password changed successfully.',
      data: tokens,
    };
  }

  // ── PIN management ────────────────────────────────────────────

  async setPin(userId: string, pin: string, confirmPin: string) {
    if (pin !== confirmPin) throw new BadRequestException('PINs do not match');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.walletPin) {
      throw new BadRequestException('PIN already set. Use change PIN instead.');
    }

    const rounds = Number(this.config.get('PIN_BCRYPT_ROUNDS', '10'));
    const walletPin = await bcrypt.hash(pin, rounds);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { walletPin } }),
      this.prisma.auditLog.create({
        data: { userId, action: 'PIN_SET', entity: 'User', entityId: userId },
      }),
    ]);

    return { message: 'Wallet PIN set successfully.' };
  }

  async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
    confirmPin: string,
  ) {
    if (newPin !== confirmPin)
      throw new BadRequestException('PINs do not match');
    if (currentPin === newPin) {
      throw new BadRequestException(
        'New PIN must be different from current PIN',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.walletPin) {
      throw new BadRequestException('No PIN set. Please set a PIN first.');
    }

    const isValid = await bcrypt.compare(currentPin, user.walletPin);
    if (!isValid) throw new UnauthorizedException('Incorrect current PIN');

    const rounds = Number(this.config.get('PIN_BCRYPT_ROUNDS', '10'));
    const walletPin = await bcrypt.hash(newPin, rounds);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { walletPin } }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'PIN_CHANGED',
          entity: 'User',
          entityId: userId,
        },
      }),
    ]);

    return { message: 'Wallet PIN changed successfully.' };
  }

  async logout(userId: string) {
    await this.deleteRefreshToken(userId);
    await this.prisma.auditLog.create({
      data: { userId, action: 'USER_LOGOUT', entity: 'User', entityId: userId },
    });
    return { message: 'Logged out successfully.' };
  }

  // ── Token helpers ─────────────────────────────────────────────

  private getRefreshTokenKey(userId: string): string {
    return `${AuthService.REFRESH_TOKEN_KEY_PREFIX}:${userId}`;
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationToSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      return 7 * 24 * 60 * 60;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 60 * 60;
      case 'd':
        return amount * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tenantId: string | null,
  ) {
    const payload: Omit<JwtUser, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role: role as UserRole,
      tenantId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
        keyid: randomUUID(),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        keyid: randomUUID(),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async issueSessionTokens(
    userId: string,
    email: string,
    role: string,
    tenantId: string | null,
  ) {
    const tokens = await this.generateTokens(userId, email, role, tenantId);

    await this.redisService.set(
      this.getRefreshTokenKey(userId),
      this.hashRefreshToken(tokens.refreshToken),
      this.parseDurationToSeconds(
        this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      ),
    );

    return tokens;
  }

  private async deleteRefreshToken(userId: string): Promise<void> {
    await this.redisService.del(this.getRefreshTokenKey(userId));
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtUser>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });

      const storedRefreshTokenHash = await this.redisService.get(
        this.getRefreshTokenKey(payload.sub),
      );

      if (
        !storedRefreshTokenHash ||
        storedRefreshTokenHash !== this.hashRefreshToken(refreshToken)
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          tenantId: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.issueSessionTokens(
        user.id,
        user.email,
        user.role,
        user.tenantId ?? null,
      );
      return { message: 'Tokens refreshed', data: tokens };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private buildTenantUserWhere(tenantId: string | null): Prisma.UserWhereInput {
    return tenantId ? { tenantId } : { tenantId: null };
  }

  private findUserByScopedEmail(email: string, tenantId: string | null) {
    return this.prisma.user.findFirst({
      where: {
        email: this.normalizeEmail(email),
        ...this.buildTenantUserWhere(tenantId),
      },
    });
  }

  private findUserByScopedPhone(phone: string, tenantId: string | null) {
    return this.prisma.user.findFirst({
      where: {
        phone: phone.trim(),
        ...this.buildTenantUserWhere(tenantId),
      },
    });
  }
}
