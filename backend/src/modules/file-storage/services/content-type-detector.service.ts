import { Injectable } from '@nestjs/common';

const MIME_BY_PURPOSE: Record<string, string[]> = {
  CV: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  SUPPORTING: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  SIGNED_OFFER: ['application/pdf'],
  GENERATED_OFFER: ['application/pdf'],
  EMPLOYEE_DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
  ],
  FINANCE_RECEIPT: ['application/pdf', 'image/jpeg', 'image/png'],
  PAYROLL_PAYSLIP: ['application/pdf'],
  PROJECT_SUPPORTING: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  // Must stay aligned with ALLOWED_EXTENSIONS_BY_PURPOSE in file-upload-session.service
  HR_REQUEST_ATTACHMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ],
};

const EXT_BY_MIME: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
};

@Injectable()
export class ContentTypeDetectorService {
  detect(magicBytes: Buffer): string | null {
    if (
      magicBytes.length >= 5 &&
      magicBytes.subarray(0, 5).toString('ascii') === '%PDF-'
    ) {
      return 'application/pdf';
    }
    if (
      magicBytes.length >= 3 &&
      magicBytes[0] === 0xff &&
      magicBytes[1] === 0xd8 &&
      magicBytes[2] === 0xff
    ) {
      return 'image/jpeg';
    }
    if (
      magicBytes.length >= 8 &&
      magicBytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return 'image/png';
    }
    if (
      magicBytes.length >= 6 &&
      (magicBytes.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        magicBytes.subarray(0, 6).toString('ascii') === 'GIF89a')
    ) {
      return 'image/gif';
    }
    if (
      magicBytes.length >= 8 &&
      magicBytes
        .subarray(0, 8)
        .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    ) {
      return 'application/msword';
    }
    if (
      magicBytes.length >= 4 &&
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x4b &&
      magicBytes[2] === 0x03 &&
      magicBytes[3] === 0x04
    ) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return null;
  }

  isAllowed(
    purpose: string,
    detectedMime: string,
    safeExtension: string,
  ): boolean {
    const allowed = MIME_BY_PURPOSE[purpose] ?? [];
    if (!allowed.includes(detectedMime)) {
      return false;
    }
    const exts = EXT_BY_MIME[detectedMime] ?? [];
    return exts.includes(safeExtension.toLowerCase());
  }
}
