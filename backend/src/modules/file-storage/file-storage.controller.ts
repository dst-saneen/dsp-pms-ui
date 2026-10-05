import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { FileUploadPurpose } from '@prisma/client';
import type { Request } from 'express';

import { Public } from '../../common';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest, AuthenticatedUser } from '../auth';
import { PasswordService } from '../auth/password.service';
import { PublicCareerOpeningService } from '../recruitment/public/public-career-opening.service';
import { PublicCareersAbuseService } from '../recruitment/public/public-careers-abuse.service';
import {
  CreatePublicUploadSessionDto,
  CreateDomainUploadSessionDto,
  CreateOfferUploadSessionDto,
  AcceptOfferWithSignedDocumentDto,
  DecideOfferSignatureDto,
} from './dto/create-upload-session.dto';
import { FileDownloadService } from './services/file-download.service';
import { FileUploadSessionService } from './services/file-upload-session.service';
import { OfferSignatureService } from './services/offer-signature.service';
import { PublicOfferTokenService } from './services/public-offer-token.service';
import { readLimitedRequestBody } from './read-limited-request-body';

function requireActiveCompanyId(user: AuthenticatedUser): string {
  const companyId = user.authorization.activeCompanyId;
  if (!companyId) {
    throw new ForbiddenException({
      code: 'ACTIVE_COMPANY_REQUIRED',
      message: 'An active company is required.',
    });
  }
  return companyId;
}

function headerValue(
  headers: Request['headers'],
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

@Controller()
export class FileStorageController {
  constructor(
    private readonly sessionService: FileUploadSessionService,
    private readonly downloadService: FileDownloadService,
    private readonly signatureService: OfferSignatureService,
    private readonly offerTokens: PublicOfferTokenService,
    private readonly passwordService: PasswordService,
    private readonly publicCareerOpenings: PublicCareerOpeningService,
    private readonly publicCareersAbuse: PublicCareersAbuseService,
  ) {}

  @Public()
  @Post('careers/openings/:openingId/upload-sessions')
  async createPublicUploadSession(
    @Param('openingId') openingId: string,
    @Body() body: CreatePublicUploadSessionDto,
    @Req() request: Request,
  ) {
    const opening = await this.publicCareerOpenings.resolveOpeningById(
      openingId,
      { requireFileStorage: true },
    );
    await this.publicCareersAbuse.verifyTurnstile(
      body.antiAbuseToken,
      request.ip,
    );
    await this.publicCareersAbuse.enforceUploadSessionRateLimit({
      ip: request.ip,
      openingId: opening.id,
    });
    return this.sessionService.createSession({
      companyId: opening.companyId,
      branchId: opening.branchId,
      purpose: body.purpose,
      jobOpeningId: openingId,
      applicationOperationId: body.applicationOperationId,
      fileName: body.fileName,
      declaredMimeType: body.declaredMimeType,
      sizeBytes: body.sizeBytes,
      checksumSha256: body.checksumSha256,
      operationId: body.applicationOperationId,
      issuePublicSessionToken: true,
    });
  }

  @Public()
  @Post('careers/openings/:openingId/upload-sessions/:sessionId/finalize')
  @HttpCode(HttpStatus.OK)
  async finalizePublicOpeningSession(
    @Param('openingId') openingId: string,
    @Param('sessionId') sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
  ) {
    const opening = await this.publicCareerOpenings.resolveOpeningById(
      openingId,
      { requireFileStorage: true },
    );
    return this.sessionService.finalizePublicOpeningSession({
      sessionId,
      companyId: opening.companyId,
      jobOpeningId: opening.id,
      publicSessionToken: sessionToken,
    });
  }

  @Public()
  @Get('careers/openings/:openingId/upload-sessions/:sessionId')
  async getPublicOpeningSession(
    @Param('openingId') openingId: string,
    @Param('sessionId') sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
  ) {
    const opening = await this.publicCareerOpenings.resolveOpeningById(
      openingId,
      { requireFileStorage: true },
    );
    return this.sessionService.getPublicOpeningSession({
      sessionId,
      companyId: opening.companyId,
      jobOpeningId: opening.id,
      publicSessionToken: sessionToken,
    });
  }

  @Post('recruitment-documents/upload-sessions')
  @RequirePermissions('hr.recruitment.manage')
  async createRecruitmentDocumentSession(
    @Body() body: CreateDomainUploadSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sessionService.createSession({
      companyId: requireActiveCompanyId(request.user),
      branchId: request.user.authorization.activeBranchId ?? null,
      purpose: body.purpose as FileUploadPurpose,
      jobApplicationId: body.domainRecordId,
      fileName: body.fileName,
      declaredMimeType: body.declaredMimeType,
      sizeBytes: body.sizeBytes,
      checksumSha256: body.checksumSha256,
      operationId: body.operationId,
      creatorUserId: request.user.id,
    });
  }

  @Post('employee-documents/upload-sessions')
  @RequirePermissions('hr.documents.manage')
  async createEmployeeDocumentSession(
    @Body() body: CreateDomainUploadSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sessionService.createSession({
      companyId: requireActiveCompanyId(request.user),
      branchId: request.user.authorization.activeBranchId ?? null,
      purpose: FileUploadPurpose.EMPLOYEE_DOCUMENT,
      employeeId: body.domainRecordId,
      fileName: body.fileName,
      declaredMimeType: body.declaredMimeType,
      sizeBytes: body.sizeBytes,
      checksumSha256: body.checksumSha256,
      operationId: body.operationId,
      creatorUserId: request.user.id,
    });
  }

  @Post('file-upload-sessions/:id/finalize')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions(
    'hr.documents.manage',
    'hr.recruitment.manage',
    'hr.self.read',
  )
  async finalizeSession(
    @Param('id') id: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sessionService.finalizeSession(
      id,
      requireActiveCompanyId(request.user),
      request.user.id,
      sessionToken,
    );
  }

  @Put('file-upload-sessions/:id/content')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions(
    'hr.documents.manage',
    'hr.recruitment.manage',
    'hr.self.read',
  )
  async putAuthenticatedSessionContent(
    @Param('id') id: string,
    @Headers('content-type') contentType: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const body = await readLimitedRequestBody(request, 25 * 1024 * 1024);
    await this.sessionService.putAuthenticatedSessionObject({
      sessionId: id,
      companyId: requireActiveCompanyId(request.user),
      actorUserId: request.user.id,
      body,
      contentType,
    });
    return { received: true };
  }

  @Get('file-upload-sessions/:id')
  @RequireAnyPermissions(
    'hr.documents.read',
    'hr.recruitment.read',
    'hr.self.read',
  )
  async getSession(
    @Param('id') id: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sessionService.getSession(
      id,
      requireActiveCompanyId(request.user),
      request.user.id,
      sessionToken,
    );
  }

  @Post('file-upload-sessions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions(
    'hr.documents.manage',
    'hr.recruitment.manage',
    'hr.self.read',
  )
  async cancelSession(
    @Param('id') id: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sessionService.cancelSession(
      id,
      requireActiveCompanyId(request.user),
      request.user.id,
      sessionToken,
    );
  }

  @Post('recruitment-documents/:id/download-grant')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr.recruitment.read')
  async grantRecruitmentDownload(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.downloadService.grantRecruitmentDocumentDownload(
      id,
      requireActiveCompanyId(request.user),
      request.user.id,
      headerValue(request.headers, 'x-request-id'),
    );
  }

  @Post('employee-documents/:id/download-grant')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr.documents.read')
  async grantEmployeeDownload(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.downloadService.grantEmployeeDocumentDownload(
      id,
      requireActiveCompanyId(request.user),
      request.user.id,
      headerValue(request.headers, 'x-request-id'),
    );
  }

  @Public()
  @Post('public/offers/:token/upload-sessions')
  async createOfferUploadSession(
    @Param('token') token: string,
    @Body() body: CreateOfferUploadSessionDto,
  ) {
    const context = await this.offerTokens.resolve(token);
    return this.signatureService.createOfferUploadSession(context, body);
  }

  @Public()
  @Post('public/offers/:token/upload-sessions/:sessionId/finalize')
  @HttpCode(HttpStatus.OK)
  async finalizeOfferSession(
    @Param('token') token: string,
    @Param('sessionId') sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
  ) {
    const context = await this.offerTokens.resolve(token);
    await this.signatureService.assertSignedOfferWorkflowAllowed(
      context.companyId,
      context.branchId,
    );
    return this.sessionService.finalizePublicOfferSession({
      sessionId,
      companyId: context.companyId,
      jobOfferId: context.jobOfferId,
      publicSessionToken: sessionToken,
    });
  }

  @Public()
  @Put('public/offers/:token/upload-sessions/:sessionId/content')
  @HttpCode(HttpStatus.OK)
  async putOfferSessionContent(
    @Param('token') token: string,
    @Param('sessionId') sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Req() request: Request,
  ) {
    const context = await this.offerTokens.resolve(token);
    await this.signatureService.assertSignedOfferWorkflowAllowed(
      context.companyId,
      context.branchId,
    );
    const body = await readLimitedRequestBody(request, 10 * 1024 * 1024);
    await this.sessionService.putPublicSessionObject({
      sessionId,
      companyId: context.companyId,
      jobOfferId: context.jobOfferId,
      publicSessionToken: sessionToken,
      body,
      contentType,
    });
    return { received: true };
  }

  @Public()
  @Get('public/offers/:token/upload-sessions/:sessionId')
  async getOfferSession(
    @Param('token') token: string,
    @Param('sessionId') sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
  ) {
    const context = await this.offerTokens.resolve(token);
    await this.signatureService.assertSignedOfferWorkflowAllowed(
      context.companyId,
      context.branchId,
    );
    return this.sessionService.getPublicOfferSession({
      sessionId,
      companyId: context.companyId,
      jobOfferId: context.jobOfferId,
      publicSessionToken: sessionToken,
    });
  }

  @Public()
  @Post('public/offers/:token/upload-sessions/:sessionId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOfferSession(
    @Param('token') token: string,
    @Param('sessionId') sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
  ) {
    const context = await this.offerTokens.resolve(token);
    await this.signatureService.assertSignedOfferWorkflowAllowed(
      context.companyId,
      context.branchId,
    );
    return this.sessionService.cancelPublicOfferSession({
      sessionId,
      companyId: context.companyId,
      jobOfferId: context.jobOfferId,
      publicSessionToken: sessionToken,
    });
  }

  @Public()
  @Post('public/offers/:token/accept-with-signed-document')
  @HttpCode(HttpStatus.OK)
  async acceptWithSignedDocument(
    @Param('token') token: string,
    @Body() body: AcceptOfferWithSignedDocumentDto,
    @Req() request: Request,
  ) {
    const context = await this.offerTokens.resolve(token);
    await this.signatureService.assertSignedOfferWorkflowAllowed(
      context.companyId,
      context.branchId,
    );
    return this.signatureService.acceptWithSignedDocument({
      tokenContext: context,
      legalName: body.legalName,
      declarationAccepted: true,
      uploadSessionId: body.uploadSessionId,
      expectedOfferVersion: body.expectedOfferVersion,
      operationId: body.operationId,
      evidence: {
        legalName: body.legalName.trim(),
        ipHash: this.passwordService.hashMetadata(request.ip),
        userAgentHash: this.passwordService.hashMetadata(
          headerValue(request.headers, 'user-agent'),
        ),
        respondedAt: new Date().toISOString(),
      },
    });
  }

  @Get('job-offers/:id/signature-submissions')
  @RequirePermissions('hr.recruitment.offer')
  async getSubmissions(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.signatureService.getSubmissions(
      id,
      requireActiveCompanyId(request.user),
    );
  }

  @Get('job-offers/:id/signature-submissions/:submissionId')
  @RequirePermissions('hr.recruitment.offer')
  async getSubmission(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.signatureService.getSubmission(
      submissionId,
      id,
      requireActiveCompanyId(request.user),
    );
  }

  @Post('job-offers/:id/signature-submissions/:submissionId/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('recruitment.offer.verify')
  async verifySubmission(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() body: DecideOfferSignatureDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.signatureService.decide({
      submissionId,
      jobOfferId: id,
      companyId: requireActiveCompanyId(request.user),
      actorUserId: request.user.id,
      expectedOfferVersion: body.expectedOfferVersion,
      expectedSubmissionVersion: body.expectedSubmissionVersion,
      operationId: body.operationId,
      reason: body.reason ?? '',
      decision: 'VERIFY',
    });
  }

  @Post('job-offers/:id/signature-submissions/:submissionId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('recruitment.offer.verify')
  async rejectSubmission(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() body: DecideOfferSignatureDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.signatureService.decide({
      submissionId,
      jobOfferId: id,
      companyId: requireActiveCompanyId(request.user),
      actorUserId: request.user.id,
      expectedOfferVersion: body.expectedOfferVersion,
      expectedSubmissionVersion: body.expectedSubmissionVersion,
      operationId: body.operationId,
      reason: body.reason ?? '',
      decision: 'REJECT',
    });
  }

  @Post('job-offers/:id/request-signature-resubmission')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('recruitment.offer.verify')
  async requestResubmission(
    @Param('id') id: string,
    @Body() body: DecideOfferSignatureDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.signatureService.requestSignatureResubmission({
      jobOfferId: id,
      companyId: requireActiveCompanyId(request.user),
      actorUserId: request.user.id,
      operationId: body.operationId,
      reason: body.reason ?? '',
      expectedOfferVersion: body.expectedOfferVersion,
    });
  }
}
