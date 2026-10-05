import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { RecruitmentCryptoService } from '../core/recruitment-crypto.service';
import { RecruitmentDocumentService } from './recruitment-document.service';
import { RecruitmentObjectStorageService } from './recruitment-object-storage.service';

@Module({
  imports: [AuthModule],
  providers: [
    RecruitmentCryptoService,
    RecruitmentObjectStorageService,
    RecruitmentDocumentService,
  ],
  exports: [
    RecruitmentCryptoService,
    RecruitmentObjectStorageService,
    RecruitmentDocumentService,
  ],
})
export class RecruitmentDocumentModule {}
