import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
} from '@nestjs/common';
import { UserRole, type JwtUser } from '@zendocx/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SystemConfigService } from './system-config.service';

@Controller('system-config')
@Roles(UserRole.SUPER_ADMIN)
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  getAll() {
    return this.systemConfigService.getAll();
  }

  @Put(':key')
  update(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    if (!value || !value.trim()) {
      throw new BadRequestException('value is required');
    }
    return this.systemConfigService.update(key, value, user.sub);
  }
}
