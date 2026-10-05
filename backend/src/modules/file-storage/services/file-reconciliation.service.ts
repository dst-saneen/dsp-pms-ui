import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import { FileObjectStatus } from '@prisma/client';
import { FileStorageFeatureService } from './file-storage-feature.service';

export interface ReconciliationReport {
  checkedObjects: number;
  missingInStorage: number;
  corruptedChecksums: number;
  markedMissing: string[];
}

@Injectable()
export class FileReconciliationService {
  private readonly logger = new Logger(FileReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageAdapter,
    private readonly features: FileStorageFeatureService,
  ) {}

  async reconcileCompany(
    companyId: string,
    limit = 100,
  ): Promise<ReconciliationReport> {
    await this.features.assertStorageWritesAllowed(companyId, null);
    const objects = await this.prisma.fileObject.findMany({
      where: {
        companyId,
        status: FileObjectStatus.CLEAN,
        deletionCompletedAt: null,
      },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });

    const report: ReconciliationReport = {
      checkedObjects: objects.length,
      missingInStorage: 0,
      corruptedChecksums: 0,
      markedMissing: [],
    };

    for (const obj of objects) {
      try {
        const meta = await this.storage.headObject(obj.objectKey);

        if (!meta) {
          this.logger.warn(
            `Object MISSING in storage: ${obj.id} key=${obj.objectKey}`,
          );
          await this.prisma.fileObject.update({
            where: { id: obj.id },
            data: { status: FileObjectStatus.MISSING },
          });
          report.missingInStorage++;
          report.markedMissing.push(obj.id);
          continue;
        }

        if (
          obj.actualChecksumSha256 &&
          meta.checksumSha256 &&
          meta.checksumSha256 !== obj.actualChecksumSha256
        ) {
          this.logger.warn(`Checksum mismatch for object ${obj.id}`);
          report.corruptedChecksums++;
        }
      } catch (err) {
        this.logger.error(
          `Reconciliation error for ${obj.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Reconciliation done for company ${companyId}: ` +
        `checked=${report.checkedObjects}, missing=${report.missingInStorage}, ` +
        `checksumErrors=${report.corruptedChecksums}`,
    );

    return report;
  }
}
