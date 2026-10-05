import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common';
import type { AuthenticatedRequest } from '../../auth';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';
import { OfferService } from './offer.service';
import {
  CreateOfferDraftDto,
  ReviseOfferDto,
  SendOfferDto,
  UpdateOfferDraftDto,
} from './dto/offer.dto';
import { SearchOfferDto } from './dto/search-offer.dto';

@ApiTags('Recruitment Offers')
@ApiBearerAuth()
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/offers')
export class OfferListController {
  constructor(private readonly offerService: OfferService) {}

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List offers in scope' })
  listAll(@Query() query: SearchOfferDto) {
    return this.offerService.listAll(query);
  }

  @Get(':offerId')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get offer by id' })
  getById(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offerService.getById(offerId);
  }
}

@ApiTags('Recruitment Offers')
@ApiBearerAuth()
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/applications/:applicationId/offers')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List offers for an application' })
  list(@Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.offerService.listForApplication(applicationId);
  }

  @Get(':offerId')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get offer by id' })
  getOne(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offerService.getOffer(applicationId, offerId);
  }

  @Post()
  @RequirePermissions('hr.recruitment.offer')
  @ApiOperation({ summary: 'Create offer draft' })
  createDraft(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateOfferDraftDto,
  ) {
    return this.offerService.createDraft(applicationId, dto ?? {});
  }

  @Patch(':offerId')
  @RequirePermissions('hr.recruitment.offer')
  @ApiOperation({ summary: 'Update offer draft' })
  updateDraft(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDraftDto,
  ) {
    return this.offerService.updateDraft(applicationId, offerId, dto ?? {});
  }

  @Post(':offerId/preview')
  @RequirePermissions('hr.recruitment.offer')
  @ApiOperation({ summary: 'Preview offer PDF' })
  preview(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offerService.preview(applicationId, offerId);
  }

  @Post(':offerId/send')
  @RequirePermissions('hr.recruitment.offer')
  @ApiOperation({ summary: 'Send offer and reserve headcount' })
  send(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() _dto: SendOfferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.offerService.send(applicationId, offerId, request.user.id);
  }

  @Post(':offerId/revoke')
  @RequirePermissions('hr.recruitment.offer')
  @ApiOperation({ summary: 'Revoke sent offer' })
  revoke(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.offerService.revoke(applicationId, offerId, request.user.id);
  }

  @Post(':offerId/retry-delivery')
  @RequirePermissions('hr.recruitment.offer')
  @ApiOperation({ summary: 'Retry offer delivery notification' })
  retryDelivery(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offerService.retryDelivery(applicationId, offerId);
  }

  @Post(':offerId/revise')
  @RequirePermissions('hr.recruitment.offer')
  @ApiOperation({ summary: 'Revise offer (creates new version)' })
  revise(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: ReviseOfferDto,
  ) {
    return this.offerService.revise(applicationId, offerId, dto ?? {});
  }
}
