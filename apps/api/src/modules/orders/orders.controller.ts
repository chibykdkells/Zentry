import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole, type JwtUser } from '@zentry/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompleteCbtJobDto } from './dto/complete-cbt-job.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetAdminDisputesQueryDto } from './dto/get-admin-disputes.dto';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders.dto';
import { GetCbtJobPoolQueryDto } from './dto/get-cbt-job-pool.dto';
import { GetCbtMyJobsQueryDto } from './dto/get-cbt-my-jobs.dto';
import { GetMyDisputesQueryDto } from './dto/get-my-disputes.dto';
import { ReviewDisputeDto } from './dto/review-dispute.dto';
import { ReviewDisputeFinancialFollowUpDto } from './dto/review-dispute-financial-follow-up.dto';
import { UpdateAdminOrderNotesDto } from './dto/update-admin-order-notes.dto';
import { OrdersService, UploadedDocumentFile } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('me')
  getMyOrders(@CurrentUser() user: JwtUser) {
    return this.ordersService.getMyOrders(user.sub, user.tenantId);
  }

  @Get('me/disputes')
  getMyDisputes(
    @CurrentUser() user: JwtUser,
    @Query() query: GetMyDisputesQueryDto,
  ) {
    return this.ordersService.getMyDisputes(user.sub, query, user.tenantId);
  }

  @Get('me/:orderId')
  getMyOrderDetail(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getMyOrderDetail(
      user.sub,
      orderId,
      user.tenantId,
    );
  }

  @Public()
  @Get('files/:orderId/result')
  async getResultFile(
    @Param('orderId') orderId: string,
    @Query('signature') signature: string,
    @Query('expires') expires: string,
    @Res() res: Response,
  ) {
    const access = await this.ordersService.getResultFileRedirect(
      orderId,
      signature,
      expires,
    );

    return res.redirect(access.data.url);
  }

  @Post('me/:orderId/dispute')
  createMyOrderDispute(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.ordersService.createDispute(
      user.sub,
      orderId,
      dto,
      user.tenantId,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/overview')
  getAdminOperationsOverview(@CurrentUser() user: JwtUser) {
    return this.ordersService.getAdminOperationsOverview(user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/release-scheduler-preview')
  getAdminReleaseSchedulerPreview(@CurrentUser() user: JwtUser) {
    return this.ordersService.getAdminReleaseSchedulerPreview(user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin')
  getAdminOrders(
    @CurrentUser() user: JwtUser,
    @Query() query: GetAdminOrdersQueryDto,
  ) {
    return this.ordersService.getAdminOrders(query, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/disputes')
  getAdminDisputes(
    @CurrentUser() user: JwtUser,
    @Query() query: GetAdminDisputesQueryDto,
  ) {
    return this.ordersService.getAdminDisputes(query, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/:orderId')
  getAdminOrderDetail(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getAdminOrderDetail(orderId, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin/:orderId/release-preview')
  getAdminOrderReleasePreview(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getAdminOrderReleasePreview(
      orderId,
      user.tenantId,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('admin/:orderId/notes')
  updateAdminOrderNotes(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateAdminOrderNotesDto,
  ) {
    return this.ordersService.updateAdminOrderNotes(
      orderId,
      dto,
      user.tenantId,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('admin/:orderId/dispute')
  reviewAdminOrderDispute(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Body() dto: ReviewDisputeDto,
  ) {
    return this.ordersService.reviewDispute(
      user.sub,
      orderId,
      dto,
      user.tenantId,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('admin/:orderId/dispute-financial-follow-up')
  reviewAdminOrderDisputeFinancialFollowUp(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Body() dto: ReviewDisputeFinancialFollowUpDto,
  ) {
    return this.ordersService.reviewDisputeFinancialFollowUp(
      user.sub,
      orderId,
      dto,
      user.tenantId,
    );
  }

  @Roles(UserRole.CBT_CENTER, UserRole.CBT_STAFF)
  @Get('cbt/dashboard')
  getCbtDashboard(@CurrentUser() user: JwtUser) {
    return this.ordersService.getCbtDashboard(user.sub, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER, UserRole.CBT_STAFF)
  @Get('cbt/job-pool')
  getCbtJobPool(
    @CurrentUser() user: JwtUser,
    @Query() query: GetCbtJobPoolQueryDto,
  ) {
    return this.ordersService.getCbtJobPool(user.sub, query, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER, UserRole.CBT_STAFF)
  @Get('cbt/my-jobs')
  getCbtMyJobs(
    @CurrentUser() user: JwtUser,
    @Query() query: GetCbtMyJobsQueryDto,
  ) {
    return this.ordersService.getCbtMyJobs(user.sub, query, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER, UserRole.CBT_STAFF)
  @Get('cbt/:orderId')
  getCbtOrderDetail(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getCbtOrderDetail(
      user.sub,
      orderId,
      user.tenantId,
    );
  }

  @Roles(UserRole.CBT_CENTER, UserRole.CBT_STAFF)
  @Post('cbt/:orderId/claim')
  claimCbtJob(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string) {
    return this.ordersService.claimCbtJob(user.sub, orderId, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER, UserRole.CBT_STAFF)
  @Post('cbt/:orderId/start')
  startCbtJob(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string) {
    return this.ordersService.startCbtJob(user.sub, orderId, user.tenantId);
  }

  @Roles(UserRole.CBT_CENTER, UserRole.CBT_STAFF)
  @Post('cbt/:orderId/result')
  @UseInterceptors(FileInterceptor('file'))
  uploadCbtResult(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() dto: CompleteCbtJobDto,
  ) {
    return this.ordersService.completeCbtJob(
      user.sub,
      orderId,
      file,
      dto,
      user.tenantId,
    );
  }

  @Post('uploads')
  @UseInterceptors(FilesInterceptor('files', 5))
  uploadRequesterDocuments(
    @CurrentUser() user: JwtUser,
    @UploadedFiles() files: UploadedDocumentFile[],
  ) {
    return this.ordersService.uploadRequesterDocuments(user.sub, files);
  }

  @Post()
  createOrder(@CurrentUser() user: JwtUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.sub, dto, user.tenantId);
  }
}
