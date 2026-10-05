import { ContentTypeDetectorService } from './content-type-detector.service';

describe('ContentTypeDetectorService', () => {
  const detector = new ContentTypeDetectorService();

  it('detects PDF magic bytes', () => {
    expect(detector.detect(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
  });

  it('allows HR_REQUEST_ATTACHMENT PDF (scan path must match session extensions)', () => {
    expect(
      detector.isAllowed('HR_REQUEST_ATTACHMENT', 'application/pdf', 'pdf'),
    ).toBe(true);
  });

  it('allows HR_REQUEST_ATTACHMENT JPEG and PNG', () => {
    expect(
      detector.isAllowed('HR_REQUEST_ATTACHMENT', 'image/jpeg', 'jpg'),
    ).toBe(true);
    expect(
      detector.isAllowed('HR_REQUEST_ATTACHMENT', 'image/png', 'png'),
    ).toBe(true);
  });

  it('rejects unknown purpose instead of silently allowing', () => {
    expect(
      detector.isAllowed('UNKNOWN_PURPOSE', 'application/pdf', 'pdf'),
    ).toBe(false);
  });
});
