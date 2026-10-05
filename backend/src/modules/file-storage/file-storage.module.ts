import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { RecruitmentDocumentModule } from '../recruitment/document/recruitment-document.module';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import { FileOperationsController } from './file-operations.controller';
import { FileStorageController } from './file-storage.controller';
import { FileStorageEnabledGuard } from './guards/file-storage-enabled.guard';
import { ContentTypeDetectorService } from './services/content-type-detector.service';
import { FileAccessAuditService } from './services/file-access-audit.service';
import { FileCommandReceiptService } from './services/file-command-receipt.service';
import { FileDocumentLinkingService } from './services/file-document-linking.service';
import { FileDownloadService } from './services/file-download.service';
import { FileReconciliationService } from './services/file-reconciliation.service';
import { FileRetentionService } from './services/file-retention.service';
import { FileStorageFeatureService } from './services/file-storage-feature.service';
import { FileUploadSessionService } from './services/file-upload-session.service';
import { FilenameEncryptionService } from './services/filename-encryption.service';
import { GeneratedFileService } from './services/generated-file.service';
import { OfferSignatureService } from './services/offer-signature.service';
import { PublicOfferTokenService } from './services/public-offer-token.service';
import { ClamAvScannerWorker } from './workers/clamav-scanner.worker';
import { FileScanWorker } from './workers/file-scan.worker';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => OutboxModule),
    AuthModule,
    forwardRef(() => RecruitmentModule),
    RecruitmentDocumentModule,
  ],
  controllers: [FileStorageController, FileOperationsController],
  providers: [
    S3StorageAdapter,
    ClamAvScannerWorker,
    FileScanWorker,
    FilenameEncryptionService,
    ContentTypeDetectorService,
    FileStorageFeatureService,
    FileStorageEnabledGuard,
    FileCommandReceiptService,
    PublicOfferTokenService,
    FileUploadSessionService,
    FileAccessAuditService,
    FileDownloadService,
    GeneratedFileService,
    OfferSignatureService,
    FileRetentionService,
    FileReconciliationService,
    FileDocumentLinkingService,
  ],
  exports: [
    FileUploadSessionService,
    FileDownloadService,
    GeneratedFileService,
    OfferSignatureService,
    S3StorageAdapter,
    FileAccessAuditService,
    ClamAvScannerWorker,
    FileRetentionService,
    FileReconciliationService,
    FileScanWorker,
    FileDocumentLinkingService,
    FilenameEncryptionService,
    PublicOfferTokenService,
    FileStorageFeatureService,
    FileStorageEnabledGuard,
  ],
})
export class FileStorageModule {}
