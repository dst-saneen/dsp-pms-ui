export interface PublicCompanyProfile {
  companyCode: string;
  companyName: string;
}

export interface PublicJobOpeningListItem {
  openingCode: string;
  title: string;
  branchLocation?: string;
  employmentType: string;
  applicationDeadline: string;
  isExpired: boolean;
}

export interface PublicJobOpeningDetail extends PublicJobOpeningListItem {
  companyName: string;
  description?: string;
  location?: string;
  canApply: boolean;
  closingMessage?: string;
}

export interface PublicApplicationDocumentInput {
  fileName: string;
  fileSize: number;
}

export interface SubmitPublicApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  coverNote?: string;
  privacyAcknowledged: boolean;
  honeypot?: string;
  turnstileToken?: string;
  idempotencyKey: string;
  cv: PublicApplicationDocumentInput;
  supportingDocuments?: PublicApplicationDocumentInput[];
  cvFile?: File;
  supportingFiles?: File[];
}

export interface PublicApplicationReceipt {
  receiptReference: string;
  message: string;
}
