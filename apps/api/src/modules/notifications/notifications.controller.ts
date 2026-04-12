import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtUser } from '@zentry/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantContext } from '../../common/decorators/tenant-context.decorator';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { RemovePushSubscriptionDto } from './dto/remove-push-subscription.dto';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getMyNotifications(
    @CurrentUser() user: JwtUser,
    @Query() query: GetNotificationsDto,
  ) {
    return this.notificationsService.getForUser(user.sub, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtUser) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Get('push-config')
  getPushConfig() {
    return this.notificationsService.getPushConfig();
  }

  @Get('push-subscriptions/status')
  getPushSubscriptionStatus(@CurrentUser() user: JwtUser) {
    return this.notificationsService.getPushSubscriptionStatus(user.sub);
  }

  @Post('push-subscriptions')
  @HttpCode(HttpStatus.OK)
  savePushSubscription(
    @CurrentUser() user: JwtUser,
    @TenantContext() tenant: { id: string } | null,
    @Body() dto: SavePushSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.notificationsService.savePushSubscription(
      user.sub,
      tenant?.id ?? null,
      dto,
      req.headers['user-agent'],
    );
  }

  @Delete('push-subscriptions')
  @HttpCode(HttpStatus.OK)
  removePushSubscription(
    @CurrentUser() user: JwtUser,
    @Body() dto: RemovePushSubscriptionDto,
  ) {
    return this.notificationsService.removePushSubscription(
      user.sub,
      dto.endpoint,
    );
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: JwtUser) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notificationsService.markRead(id, user.sub);
  }
}
