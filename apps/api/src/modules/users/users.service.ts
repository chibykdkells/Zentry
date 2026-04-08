import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const nextPhone = dto.phone?.trim();

    if (nextPhone && nextPhone !== existingUser.phone) {
      const conflictingUser = await this.prisma.user.findUnique({
        where: { phone: nextPhone },
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
