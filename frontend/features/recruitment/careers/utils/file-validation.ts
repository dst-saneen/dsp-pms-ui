import {
  PUBLIC_ALLOWED_EXTENSIONS,
  PUBLIC_MAX_FILE_SIZE_BYTES,
  PUBLIC_MAX_SUPPORTING_DOCUMENTS,
} from "../constants/public-careers-content";

export function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  if (index < 0) return "";
  return fileName.slice(index).toLowerCase();
}

export function validatePublicDocument(
  file: File,
  options?: { required?: boolean; label?: string },
) {
  const label = options?.label ?? "File";

  if (!file) {
    return options?.required ? `${label} is required.` : null;
  }

  const extension = getFileExtension(file.name);
  if (
    !PUBLIC_ALLOWED_EXTENSIONS.includes(
      extension as (typeof PUBLIC_ALLOWED_EXTENSIONS)[number],
    )
  ) {
    return `${label} must be PDF, DOC, or DOCX.`;
  }

  if (file.size > PUBLIC_MAX_FILE_SIZE_BYTES) {
    return `${label} must be 10 MB or smaller.`;
  }

  return null;
}

export function validateSupportingDocuments(files: File[]) {
  if (files.length > PUBLIC_MAX_SUPPORTING_DOCUMENTS) {
    return `You can upload up to ${PUBLIC_MAX_SUPPORTING_DOCUMENTS} supporting documents.`;
  }

  for (const file of files) {
    const error = validatePublicDocument(file, { label: "Supporting document" });
    if (error) return error;
  }

  return null;
}

export function slugifyCompanyCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
