import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { JwtUser } from '@zentry/types';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
}
