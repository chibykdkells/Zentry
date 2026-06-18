import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
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
import axios from 'axios';
import type { Response } from 'express';
import { UserRole, type JwtUser } from '@zendocx/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/decorators/tenant-context.decorator';
import { CompleteCbtJobDto } from './dto/complete-cbt-job.dto';
import { ApplyAdminOrderPricingRemediationDto } from './dto/apply-admin-order-pricing-remediation.dto';
import { CleanupOrderUploadsDto } from './dto/cleanup-order-uploads.dto';
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
import { RequestExtensionDto } from './dto/request-extension.dto';
import { ReviewExtensionDto } from './dto/review-extension.dto';
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
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const isDownload = download === '1';
    const access = await this.ordersService.getResultFileRedirect(
      orderId,
      signature,
      expires,
      isDownload,
    );

    // Proxy the file bytes directly so the browser never sees Cloudinary's
    // X-Frame-Options headers, which would block the result from loading
    // inside an <iframe> on the frontend domain.
    type StreamResponse = { headers: Record<string, string>; data: NodeJS.ReadableStream };
    let upstream: StreamResponse;
    try {
      upstream = (await axios.get(access.data.url, {
        responseType: 'stream',
        timeout: 30_000,
      })) as StreamResponse;
    } catch {
      throw new InternalServerErrorException('Could not retrieve result file.');
    }

    const contentType = upstream.headers['content-type'] ?? 'application/octet-stream';

    res.setHeader('Content-Type', contentType);

    if (isDownload) {
      res.setHeader('Content-Disposition', 'attachment');
    }

    upstream.data.pipe(res);
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
  @Get('admin/pricing-remediation-preview')
  getAdminOrderPricingRemediationPreview(@CurrentUser() user: JwtUser) {
    return this.ordersService.getAdminOrderPricingRemediationPreview(
      user.tenantId,
    );
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('admin/pricing-remediation/apply')
  applyAdminOrderPricingRemediation(
    @CurrentUser() user: JwtUser,
    @Body() dto: ApplyAdminOrderPricingRemediationDto,
  ) {
    return this.ordersService.applyAdminOrderPricingRemediation(
      user.sub,
      dto,
      user.tenantId,
    );
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @Get('admin')
  getAdminOrders(
    @CurrentUser() user: JwtUser,
    @Query() query: GetAdminOrdersQueryDto,
  ) {
    return this.ordersService.getAdminOrders(query, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @Get('admin/disputes')
  getAdminDisputes(
    @CurrentUser() user: JwtUser,
    @Query() query: GetAdminDisputesQueryDto,
  ) {
    return this.ordersService.getAdminDisputes(query, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @Get('admin/:orderId')
  getAdminOrderDetail(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getAdminOrderDetail(orderId, user.tenantId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
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

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
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

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
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

  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
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
  @Post('cbt/:orderId/request-extension')
  requestTimeExtension(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
    @Body() dto: RequestExtensionDto,
  ) {
    return this.ordersService.requestTimeExtension(user.sub, orderId, dto, user.tenantId);
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Get('admin/extension-requests')
  getPendingExtensionRequests(@CurrentUser() user: JwtUser) {
    return this.ordersService.getPendingExtensionRequests(user.tenantId);
  }

  @Roles(UserRole.TENANT_ADMIN)
  @Post('admin/extension-requests/:extensionId/review')
  reviewTimeExtension(
    @CurrentUser() user: JwtUser,
    @Param('extensionId') extensionId: string,
    @Body() dto: ReviewExtensionDto,
  ) {
    return this.ordersService.reviewTimeExtension(user.sub, extensionId, dto, user.tenantId);
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

  @Post('uploads/cleanup')
  cleanupRequesterDocuments(
    @CurrentUser() user: JwtUser,
    @Body() dto: CleanupOrderUploadsDto,
  ) {
    return this.ordersService.cleanupUploadedOrderFiles(
      user.sub,
      dto.publicIds,
    );
  }

  @Post()
  createOrder(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateOrderDto,
    @TenantContext() tenant: { id: string } | null,
  ) {
    return this.ordersService.createOrder(
      user.sub,
      dto,
      user.tenantId ?? tenant?.id ?? null,
    );
  }
}
