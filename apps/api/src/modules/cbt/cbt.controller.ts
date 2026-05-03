import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, type JwtUser } from '@zendocx/types';
import { CbtService } from './cbt.service';
import { CreateCbtStaffDto } from './dto/create-cbt-staff.dto';

@Controller('cbt')
export class CbtController {
  constructor(private readonly cbtService: CbtService) {}

  /** List all staff accounts for the authenticated CBT center */
  @Get('staff')
  @Roles(UserRole.CBT_CENTER)
  listStaff(@CurrentUser() user: JwtUser) {
    return this.cbtService.listStaff(user.sub);
  }

  /** Create a new staff account for the authenticated CBT center */
  @Post('staff')
  @Roles(UserRole.CBT_CENTER)
  createStaff(@CurrentUser() user: JwtUser, @Body() dto: CreateCbtStaffDto) {
    return this.cbtService.createStaff(user.sub, user.tenantId, dto);
  }

  /** Delete a staff account (CBT center must own the account; no active orders) */
  @Delete('staff/:staffId')
  @Roles(UserRole.CBT_CENTER)
  deleteStaff(@CurrentUser() user: JwtUser, @Param('staffId') staffId: string) {
    return this.cbtService.deleteStaff(user.sub, staffId);
  }
}
