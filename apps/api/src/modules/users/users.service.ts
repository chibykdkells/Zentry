import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CbtApprovalStatus, NotificationType, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMe(userId: string) {
    const user = await this.findProfileByUserId(userId);

    return {
      message: 'Profile retrieved',
      data: user,
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (!dto.firstName && !dto.lastName && !dto.phone) {
      throw new BadRequestException(
        'Provide at least one profile field to update',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        tenantId: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const nextPhone = dto.phone?.trim();

    if (nextPhone && nextPhone !== existingUser.phone) {
      const conflictingUser = await this.prisma.user.findFirst({
        where: {
          phone: nextPhone,
          ...(existingUser.tenantId
            ? { tenantId: existingUser.tenantId }
            : { tenantId: null }),
        },
        select: { id: true },
      });

      if (conflictingUser && conflictingUser.id !== userId) {
        throw new ConflictException('Phone number is already registered');
      }
    }

    const oldValues = {
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      phone: existingUser.phone,
    };

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName?.trim() ?? existingUser.firstName,
          lastName: dto.lastName?.trim() ?? existingUser.lastName,
          phone: nextPhone ?? existingUser.phone,
          ...(nextPhone && nextPhone !== existingUser.phone
            ? { isPhoneVerified: false }
            : {}),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'PROFILE_UPDATED',
          entity: 'User',
          entityId: userId,
          oldValues,
          newValues: {
            firstName: dto.firstName?.trim() ?? existingUser.firstName,
            lastName: dto.lastName?.trim() ?? existingUser.lastName,
            phone: nextPhone ?? existingUser.phone,
          },
        },
      }),
    ]);

    const updatedUser = await this.findProfileByUserId(userId);

    return {
      message: 'Profile updated successfully.',
      data: updatedUser,
    };
  }

  async getAdminCbtApplications(
    adminTenantId: string | null,
    query: { status?: CbtApprovalStatus; page?: number; limit?: number },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = {
      role: UserRole.CBT_CENTER,
      ...(adminTenantId ? { tenantId: adminTenantId } : {}),
      cbtProfile: {
        ...(query.status ? { approvalStatus: query.status } : {}),
      },
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          createdAt: true,
          cbtProfile: {
            select: {
              id: true,
              centerName: true,
              licenseNumber: true,
              supportingDocUrl: true,
              address: true,
              state: true,
              lga: true,
              approvalStatus: true,
              approvedAt: true,
              rejectionReason: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      message: 'CBT applications retrieved',
      data: {
        items: users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveCbtCenter(
    adminId: string,
    cbtUserId: string,
    adminTenantId: string | null,
  ) {
    const cbtUser = await this.prisma.user.findUnique({
      where: { id: cbtUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
        tenantId: true,
        cbtProfile: {
          select: { id: true, centerName: true, approvalStatus: true },
        },
      },
    });

    if (!cbtUser || cbtUser.role !== UserRole.CBT_CENTER) {
      throw new NotFoundException('CBT center not found');
    }

    if (adminTenantId && (cbtUser.tenantId ?? null) !== adminTenantId) {
      throw new ForbiddenException('CBT center does not belong to your tenant');
    }

    if (!cbtUser.cbtProfile) {
      throw new NotFoundException('CBT profile not found');
    }

    if (cbtUser.cbtProfile.approvalStatus === CbtApprovalStatus.APPROVED) {
      throw new ConflictException('CBT center is already approved');
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.cbtProfile.update({
        where: { userId: cbtUserId },
        data: {
          approvalStatus: CbtApprovalStatus.APPROVED,
          approvedAt: now,
          approvedById: adminId,
          rejectionReason: null,
        },
      }),
      this.prisma.notification.create({
        data: {
          userId: cbtUserId,
          type: NotificationType.CBT_APPROVED,
          title: 'Your CBT center has been approved',
          message: `${cbtUser.cbtProfile.centerName} is now approved and can access the job pool.`,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'CBT_CENTER_APPROVED',
          entity: 'CbtProfile',
          entityId: cbtUser.cbtProfile.id,
          newValues: { cbtUserId, approvedAt: now.toISOString() },
        },
      }),
    ]);

    this.notificationsService.pushNotificationToUser(cbtUserId, {
      type: 'CBT_APPROVED',
      title: 'Your CBT center has been approved',
      message: `${cbtUser.cbtProfile.centerName} is now approved and can access the job pool.`,
    });

    return { message: 'CBT center approved successfully' };
  }

  async rejectCbtCenter(
    adminId: string,
    cbtUserId: string,
    reason: string,
    adminTenantId: string | null,
  ) {
    const cbtUser = await this.prisma.user.findUnique({
      where: { id: cbtUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
        tenantId: true,
        cbtProfile: {
          select: { id: true, centerName: true, approvalStatus: true },
        },
      },
    });

    if (!cbtUser || cbtUser.role !== UserRole.CBT_CENTER) {
      throw new NotFoundException('CBT center not found');
    }

    if (adminTenantId && (cbtUser.tenantId ?? null) !== adminTenantId) {
      throw new ForbiddenException('CBT center does not belong to your tenant');
    }

    if (!cbtUser.cbtProfile) {
      throw new NotFoundException('CBT profile not found');
    }

    if (cbtUser.cbtProfile.approvalStatus === CbtApprovalStatus.REJECTED) {
      throw new ConflictException('CBT center is already rejected');
    }

    await this.prisma.$transaction([
      this.prisma.cbtProfile.update({
        where: { userId: cbtUserId },
        data: {
          approvalStatus: CbtApprovalStatus.REJECTED,
          approvedAt: null,
          approvedById: null,
          rejectionReason: reason.trim(),
        },
      }),
      this.prisma.notification.create({
        data: {
          userId: cbtUserId,
          type: NotificationType.CBT_REJECTED,
          title: 'CBT center application not approved',
          message: `Your application for ${cbtUser.cbtProfile.centerName} was not approved. Reason: ${reason.trim()}`,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'CBT_CENTER_REJECTED',
          entity: 'CbtProfile',
          entityId: cbtUser.cbtProfile.id,
          newValues: { cbtUserId, reason: reason.trim() },
        },
      }),
    ]);

    this.notificationsService.pushNotificationToUser(cbtUserId, {
      type: 'CBT_REJECTED',
      title: 'CBT center application not approved',
      message: `Your application for ${cbtUser.cbtProfile.centerName} was not approved.`,
    });

    return { message: 'CBT center rejected' };
  }

  private async findProfileByUserId(userId: string) {
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

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { walletPin, ...safeUser } = user;

    return {
      ...safeUser,
      hasWalletPin: Boolean(walletPin),
    };
  }
}
