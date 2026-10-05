export const PUBLIC_CV_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const PUBLIC_ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

export const PUBLIC_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const PUBLIC_MAX_SUPPORTING_DOCUMENTS = 5;

export const PUBLIC_PRIVACY_NOTICE =
  "We collect your application details and documents only to assess your candidacy for this role. Data is stored securely, scanned for malware, and retained according to our approved recruitment privacy policy.";

export const PUBLIC_PRIVACY_RETENTION_LINK = "/privacy/recruitment";

export const PUBLIC_APPLICATION_SUCCESS_MESSAGE =
  "Thank you for applying. If your profile matches our requirements, our recruitment team will contact you using the email address you provided.";
