import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Environment, validateEnvironment } from '../../src/config';
import { RecruitmentCryptoService } from '../../src/modules/recruitment/core/recruitment-crypto.service';
import { RecruitmentObjectStorageService } from '../../src/modules/recruitment/document/recruitment-object-storage.service';

describe('RecruitmentObjectStorageService', () => {
  let uploadRoot: string;
  let service: RecruitmentObjectStorageService;

  beforeEach(() => {
    uploadRoot = mkdtempSync(join(tmpdir(), 'dsp-recruitment-storage-'));
    const environment = validateEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://test-user:test-password@localhost:5432/test-db',
      DATABASE_SCHEMA: 'dsp_pms',
      RECRUITMENT_UPLOAD_DIR: uploadRoot,
      STORAGE_S3_PREFIX: 'dsp-pms-stg',
      STORAGE_S3_REGION: 'ap-south-1',
    });
    const config = new ConfigService<Environment, true>(environment);
    const crypto = {
      encryptBuffer: (value: Buffer) => value,
      decryptBuffer: (value: Buffer) => value,
    } as RecruitmentCryptoService;

    service = new RecruitmentObjectStorageService(config, crypto);
  });

  afterEach(() => {
    rmSync(uploadRoot, { recursive: true, force: true });
  });

  it('writes new recruitment objects inside the deployment namespace', async () => {
    const content = Buffer.from('synthetic-cv');

    const storageKey = await service.putObject(
      'candidate-1/resume.pdf',
      content,
    );

    expect(storageKey).toBe('dsp-pms-stg/recruitment/candidate-1/resume.pdf');
    expect(readFileSync(join(uploadRoot, storageKey))).toEqual(content);
    await expect(service.getObject(storageKey)).resolves.toEqual(content);
  });

  it('keeps existing unprefixed recruitment objects readable', async () => {
    const legacyKey = 'candidate-legacy/resume.pdf';
    const content = Buffer.from('legacy-synthetic-cv');
    mkdirSync(join(uploadRoot, 'candidate-legacy'), { recursive: true });
    writeFileSync(join(uploadRoot, legacyKey), content);

    await expect(service.getObject(legacyKey)).resolves.toEqual(content);
  });

  it('stores quarantined objects inside the deployment namespace', async () => {
    const content = Buffer.from('scanner-test-payload');

    const storageKey = await service.quarantineObject(
      'candidate-1/scanner-test.pdf',
      content,
    );

    expect(storageKey).toMatch(
      /^dsp-pms-stg\/recruitment\/quarantine\/\d+-candidate-1_scanner-test\.pdf$/,
    );
    await expect(service.getObject(storageKey)).resolves.toEqual(content);
  });

  it('rejects storage-key traversal', async () => {
    await expect(
      service.putObject('../outside.pdf', Buffer.from('invalid')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
