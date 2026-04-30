import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { CbtApprovalStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCbtStaffDto } from './dto/create-cbt-staff.dto';

@Injectable()
export class CbtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createStaff(
    cbtUserId: string,
    tenantId: string | null,
    dto: CreateCbtStaffDto,
  ) {
    const cbtCenter = await this.prisma.user.findFirst({
      where: {
        id: cbtUserId,
        role: UserRole.CBT_CENTER,
        ...(tenantId ? { tenantId } : { tenantId: null }),
      },
      select: {
        id: true,
        tenantId: true,
        cbtProfile: { select: { centerName: true, approvalStatus: true } },
      },
    });

    if (!cbtCenter?.cbtProfile) {
      throw new NotFoundException('CBT profile not found');
    }

    if (cbtCenter.cbtProfile.approvalStatus !== CbtApprovalStatus.APPROVED) {
      throw new ForbiddenException(
        'Your CBT center must be approved before you can add staff.',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = dto.phone.trim();

    // Email/phone uniqueness is scoped by tenantId (same unique constraint as User table)
    const [emailConflict, phoneConflict] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          ...(cbtCenter.tenantId ? { tenantId: cbtCenter.tenantId } : { tenantId: null }),
        },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: {
          phone: normalizedPhone,
          ...(cbtCenter.tenantId ? { tenantId: cbtCenter.tenantId } : { tenantId: null }),
        },
        select: { id: true },
      }),
    ]);

    if (emailConflict) throw new ConflictException('Email is already registered');
    if (phoneConflict) throw new ConflictException('Phone number is already registered');

    const rounds = Number(this.config.get('BCRYPT_ROUNDS', '12'));
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const staff = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          role: UserRole.CBT_STAFF,
          tenantId: cbtCenter.tenantId,
          isEmailVerified: true,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.wallet.create({ data: { userId: user.id } });

      await tx.cbtStaffMembership.create({
        data: { cbtId: cbtUserId, staffId: user.id },
      });

      await tx.auditLog.create({
        data: {
          userId: cbtUserId,
          tenantId: cbtCenter.tenantId,
          action: 'CBT_STAFF_CREATED',
          entity: 'User',
          entityId: user.id,
          newValues: {
            role: UserRole.CBT_STAFF,
            email: user.email,
            cbtId: cbtUserId,
            centerName: cbtCenter.cbtProfile!.centerName,
          },
        },
      });

      return user;
    });

    return {
      message: 'Staff account created successfully.',
      data: { ...staff, cbtId: cbtUserId },
    };
  }

  async listStaff(cbtUserId: string) {
    const memberships = await this.prisma.cbtStaffMembership.findMany({
      where: { cbtId: cbtUserId },
      select: {
        id: true,
        createdAt: true,
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Staff list retrieved.',
      data: memberships.map((m) => ({
        membershipId: m.id,
        joinedAt: m.createdAt,
        ...m.staff,
      })),
    };
  }

  async deleteStaff(cbtUserId: string, staffId: string) {
    const membership = await this.prisma.cbtStaffMembership.findUnique({
      where: { staffId },
      select: { id: true, cbtId: true },
    });

    if (!membership) {
      throw new NotFoundException('Staff member not found');
    }

    if (membership.cbtId !== cbtUserId) {
      throw new ForbiddenException('You do not manage this staff account');
    }

    const activeOrders = await this.prisma.order.count({
      where: {
        assignedCbtId: staffId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    });

    if (activeOrders > 0) {
      throw new ConflictException(
        'This staff member has active orders. Reassign or complete them first.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cbtStaffMembership.delete({ where: { staffId } });
      await tx.user.delete({ where: { id: staffId } });
      await tx.auditLog.create({
        data: {
          userId: cbtUserId,
          action: 'CBT_STAFF_DELETED',
          entity: 'User',
          entityId: staffId,
          newValues: { cbtId: cbtUserId },
        },
      });
    });

    return { message: 'Staff account removed.' };
  }
}
