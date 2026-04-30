import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { JwtUser } from '@zendocx/types';
import { UserRole } from '@zendocx/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { GetAdminServicesQueryDto } from './dto/get-admin-services.dto';
import { GetServiceCatalogQueryDto } from './dto/get-service-catalog.dto';
import { UpdateVtuProviderConfigDto } from './dto/update-vtu-provider-config.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/categories')
  getAdminCategories() {
    return this.servicesService.getAdminCategories();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/services')
  getAdminServices(@Query() query: GetAdminServicesQueryDto) {
    return this.servicesService.getAdminServices(query);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/provider-readiness')
  getProviderReadiness() {
    return this.servicesService.getProviderReadiness();
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Get('tenant/provider-readiness')
  getTenantProviderReadiness(@CurrentUser() user: JwtUser) {
    return this.servicesService.getTenantProviderReadiness(user.tenantId ?? '');
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Get('tenant/manage')
  getTenantServiceManagementCatalog(
    @CurrentUser() user: JwtUser,
    @Query() query: GetServiceCatalogQueryDto,
  ) {
    return this.servicesService.getTenantServiceManagementCatalog(
      user.tenantId ?? '',
      query,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('admin/provider-readiness/vtu')
  updateVtuProviderConfig(@Body() dto: UpdateVtuProviderConfigDto) {
    return this.servicesService.updateVtuProviderConfig(dto);
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Patch('tenant/provider-readiness/vtu')
  updateTenantVtuProviderConfig(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateVtuProviderConfigDto,
  ) {
    return this.servicesService.updateTenantVtuProviderConfig(
      user.tenantId ?? '',
      dto,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('admin/provider-readiness/vtu/validate')
  validateVtuProviderConfig() {
    return this.servicesService.validateVtuProviderConfig();
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Post('tenant/provider-readiness/vtu/validate')
  validateTenantVtuProviderConfig(@CurrentUser() user: JwtUser) {
    return this.servicesService.validateTenantVtuProviderConfig(
      user.tenantId ?? '',
    );
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Patch('tenant/manage')
  updateTenantServiceSelection(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      usesCustomSelection?: boolean;
      selectedServiceSlugs?: string[];
    },
  ) {
    return this.servicesService.updateTenantServiceSelection(
      user.tenantId ?? '',
      {
        usesCustomSelection: Boolean(body.usesCustomSelection),
        selectedServiceSlugs: body.selectedServiceSlugs ?? [],
      },
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('admin/categories')
  createCategory(@Body() dto: CreateServiceCategoryDto) {
    return this.servicesService.createCategory(dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('admin/categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    return this.servicesService.updateCategory(id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete('admin/categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.servicesService.deleteCategory(id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('admin/services')
  createService(@Body() dto: CreateServiceDto) {
    return this.servicesService.createService(dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('admin/services/:id')
  updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.updateService(id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete('admin/services/:id')
  deleteService(@Param('id') id: string) {
    return this.servicesService.deleteService(id);
  }

  @Get('catalog')
  getCatalog(
    @Query() query: GetServiceCatalogQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.servicesService.getCatalog(query, user.tenantId);
  }

  @Get('vtu/data-plans/:serviceId')
  getVtuDataPlans(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.servicesService.getVtuDataPlans(serviceId, user.tenantId);
  }

  @Get('vtu/cable-plans/:serviceId')
  getVtuCablePlans(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.servicesService.getVtuCablePlans(serviceId, user.tenantId);
  }

  @Post('vtu/cable-verify/:serviceId')
  verifyVtuCable(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { smartcardNumber?: string },
  ) {
    return this.servicesService.verifyVtuCable(
      serviceId,
      body.smartcardNumber ?? '',
      user.tenantId,
    );
  }

  @Post('vtu/electricity-verify/:serviceId')
  verifyVtuElectricity(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { meterNumber?: string; meterType?: string },
  ) {
    return this.servicesService.verifyVtuElectricity(
      serviceId,
      {
        meterNumber: body.meterNumber ?? '',
        meterType: body.meterType ?? '',
      },
      user.tenantId,
    );
  }
}
