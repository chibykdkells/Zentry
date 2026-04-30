import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TenantContext } from '../../common/decorators/tenant-context.decorator';
import { JwtUser, UserRole } from '@zendocx/types';
import type { Tenant } from '@prisma/client';
import type { Request } from 'express';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { GetTenantUsersDto } from './dto/get-tenant-users.dto';
import { UpdateOwnTenantSettingsDto } from './dto/update-own-tenant-settings.dto';
import { UpdateTenantUserRoleDto } from './dto/update-tenant-user-role.dto';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * Public endpoint — frontend calls this on load to get branding config.
   * Tenant is resolved (in priority order) from:
   *   1. TenantContext (subdomain / host header)
   *   2. ?slug= query param (white-label slug routing)
   *   3. ?tenantId= query param (used by authenticated tenant users whose
   *      tenantId is stored in their JWT but whose URL carries no slug)
   */
  @Get('config')
  @Public()
  async getConfig(
    @Req() _request: Request,
    @TenantContext() tenant: Tenant | null,
    @Query('slug') slug?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    let resolvedTenant: Tenant | null =
      tenant ??
      (slug ? await this.tenantService.getActiveTenantBySlug(slug) : null);

    if (!resolvedTenant && tenantId) {
      try {
        resolvedTenant = await this.tenantService.getTenantById(tenantId);
      } catch {
        // tenantId not found — fall through to platform context
        resolvedTenant = null;
      }
    }

    return {
      message: resolvedTenant
        ? 'Tenant config retrieved'
        : 'Platform context active',
      data: resolvedTenant ? this.tenantService.toPublic(resolvedTenant) : null,
    };
  }

  /** SUPER_ADMIN: create a new tenant */
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async createTenant(
    @Body() body: CreateTenantDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenantService.createTenant(body, user.sub);
  }

  /** SUPER_ADMIN: list all tenants */
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  async listTenants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.tenantService.listTenants({ page, limit, search });
  }

  @Get('me')
  @Roles(UserRole.TENANT_ADMIN)
  async getMyTenantOverview(@CurrentUser() user: JwtUser) {
    return this.tenantService.getTenantOverviewForAdmin(user.sub);
  }

  @Get('me/users')
  @Roles(UserRole.TENANT_ADMIN)
  async getMyTenantUsers(
    @CurrentUser() user: JwtUser,
    @Query() query: GetTenantUsersDto,
  ) {
    return this.tenantService.getTenantUsersForAdmin(user.sub, query);
  }

  @Patch('me/users/:userId/role')
  @Roles(UserRole.TENANT_ADMIN)
  async updateMyTenantUserRole(
    @CurrentUser() user: JwtUser,
    @Param('userId') targetUserId: string,
    @Body() body: UpdateTenantUserRoleDto,
  ) {
    return this.tenantService.updateTenantUserRoleForAdmin(
      user.sub,
      targetUserId,
      body.role,
    );
  }

  @Delete('me/users/:userId')
  @Roles(UserRole.TENANT_ADMIN)
  async deleteMyTenantUser(
    @CurrentUser() user: JwtUser,
    @Param('userId') targetUserId: string,
  ) {
    return this.tenantService.deleteTenantUserForAdmin(user.sub, targetUserId);
  }

  @Patch('me')
  @Roles(UserRole.TENANT_ADMIN)
  async updateMyTenantSettings(
    @CurrentUser() user: JwtUser,
    @Body() body: UpdateOwnTenantSettingsDto,
  ) {
    return this.tenantService.updateOwnTenantSettings(user.sub, body);
  }

  @Post('me/logo')
  @Roles(UserRole.TENANT_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyTenantLogo(
    @CurrentUser() user: JwtUser,
    @UploadedFile()
    file:
      | {
          originalname: string;
          mimetype: string;
          size: number;
          buffer: Buffer;
        }
      | undefined,
  ) {
    return this.tenantService.uploadTenantLogo(user.sub, file);
  }

  @Get(':id/users')
  @Roles(UserRole.SUPER_ADMIN)
  async getTenantUsersForPlatformAdmin(
    @Param('id') id: string,
    @Query() query: GetTenantUsersDto,
  ) {
    return this.tenantService.getTenantUsersForPlatformAdmin(id, query);
  }

  /** SUPER_ADMIN: toggle active status for any user in a tenant (including TENANT_ADMIN) */
  @Patch(':tenantId/users/:userId/active')
  @Roles(UserRole.SUPER_ADMIN)
  async toggleTenantUserActive(
    @CurrentUser() user: JwtUser,
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.tenantService.toggleTenantUserActiveForPlatformAdmin(
      user.sub,
      tenantId,
      userId,
    );
  }

  /** SUPER_ADMIN: permanently delete a user in a tenant (including TENANT_ADMIN, no-history accounts only) */
  @Delete(':tenantId/users/:userId')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteTenantUserByPlatformAdmin(
    @CurrentUser() user: JwtUser,
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.tenantService.deleteTenantUserForPlatformAdmin(
      user.sub,
      tenantId,
      userId,
    );
  }

  /** SUPER_ADMIN: get a single tenant */
  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async getTenant(@Param('id') id: string) {
    return this.tenantService.getTenantById(id);
  }

  /** SUPER_ADMIN: update a tenant */
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateTenant(@Param('id') id: string, @Body() body: UpdateTenantDto) {
    return this.tenantService.updateTenant(id, body);
  }

  /** SUPER_ADMIN: provision a TENANT_ADMIN user for a tenant. Returns a one-time temp password. */
  @Post(':id/admins')
  @Roles(UserRole.SUPER_ADMIN)
  async createTenantAdmin(
    @Param('id') id: string,
    @Body() body: CreateTenantAdminDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenantService.createTenantAdmin(id, body, user.sub);
  }

  @Post(':tenantId/admins/:userId/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  async resetTenantAdminAccess(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenantService.resetTenantAdminAccessForPlatformAdmin(
      tenantId,
      userId,
      user.sub,
    );
  }

  @Patch(':tenantId/admin-access/:accessId/dismiss')
  @Roles(UserRole.SUPER_ADMIN)
  async dismissTenantAdminAccess(
    @Param('tenantId') tenantId: string,
    @Param('accessId') accessId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenantService.dismissTenantAdminAccessForPlatformAdmin(
      tenantId,
      accessId,
      user.sub,
    );
  }
}
