import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CbtApprovalStatus, UserRole, type JwtUser } from '@zentry/types';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  @Audit({
    action: 'PROFILE_UPDATED',
    entity: 'User',
    lookup: 'current_user',
    mergeExisting: true,
    captureRequestFields: ['firstName', 'lastName', 'phone'],
  })
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  // ── Admin: CBT Approvals ─────────────────────────────────────────

  @Get('admin/cbt')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  getAdminCbtApplications(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const validStatuses = Object.values(CbtApprovalStatus) as string[];
    const parsedStatus =
      status && validStatuses.includes(status)
        ? (status as CbtApprovalStatus)
        : undefined;

    return this.usersService.getAdminCbtApplications(user.tenantId ?? null, {
      status: parsedStatus,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('admin/cbt/:userId/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  approveCbtCenter(
    @CurrentUser() user: JwtUser,
    @Param('userId') cbtUserId: string,
  ) {
    return this.usersService.approveCbtCenter(
      user.sub,
      cbtUserId,
      user.tenantId ?? null,
    );
  }

  @Post('admin/cbt/:userId/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  rejectCbtCenter(
    @CurrentUser() user: JwtUser,
    @Param('userId') cbtUserId: string,
    @Body('reason') reason: string,
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException(
        'A rejection reason of at least 5 characters is required',
      );
    }
    return this.usersService.rejectCbtCenter(
      user.sub,
      cbtUserId,
      reason,
      user.tenantId ?? null,
    );
  }
}
