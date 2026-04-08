import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@zentry/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { GetAdminServicesQueryDto } from './dto/get-admin-services.dto';
import { GetServiceCatalogQueryDto } from './dto/get-service-catalog.dto';
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
  @Post('admin/services')
  createService(@Body() dto: CreateServiceDto) {
    return this.servicesService.createService(dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('admin/services/:id')
  updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.updateService(id, dto);
  }

  @Get('catalog')
  getCatalog(@Query() query: GetServiceCatalogQueryDto) {
    return this.servicesService.getCatalog(query);
  }
}
