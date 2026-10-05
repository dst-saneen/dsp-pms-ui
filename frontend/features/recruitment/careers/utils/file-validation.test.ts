import { describe, expect, it } from "vitest";

import {
  getFileExtension,
  validatePublicDocument,
  validateSupportingDocuments,
} from "./file-validation";

describe("validatePublicDocument", () => {
  it("rejects unsupported file types", () => {
    const file = new File(["content"], "resume.txt", { type: "text/plain" });
    expect(validatePublicDocument(file, { required: true })).toBe(
      "File must be PDF, DOC, or DOCX.",
    );
  });

  it("rejects files larger than 10 MB", () => {
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "resume.pdf", {
      type: "application/pdf",
    });
    expect(validatePublicDocument(file, { required: true })).toBe(
      "File must be 10 MB or smaller.",
    );
  });

  it("accepts valid PDF uploads", () => {
    const file = new File(["content"], "resume.pdf", { type: "application/pdf" });
    expect(validatePublicDocument(file, { required: true })).toBeNull();
  });
});

describe("validateSupportingDocuments", () => {
  it("rejects more than five supporting documents", () => {
    const files = Array.from({ length: 6 }, (_, index) =>
      new File(["content"], `doc-${index}.pdf`, { type: "application/pdf" }),
    );

    expect(validateSupportingDocuments(files)).toBe(
      "You can upload up to 5 supporting documents.",
    );
  });
});

describe("getFileExtension", () => {
  it("returns lowercase extension", () => {
    expect(getFileExtension("Resume.PDF")).toBe(".pdf");
  });
});
