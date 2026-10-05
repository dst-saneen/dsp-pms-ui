import { describe, expect, it } from "vitest";

import { PUBLIC_APPLICATION_SUCCESS_MESSAGE } from "../constants/public-careers-content";
import { toSafePublicReceipt } from "./safe-public-receipt";

describe("toSafePublicReceipt", () => {
  it("keeps candidate-facing application codes", () => {
    expect(
      toSafePublicReceipt({
        receiptReference: "APP-ENG-001-A1B2",
        message: PUBLIC_APPLICATION_SUCCESS_MESSAGE,
      }),
    ).toEqual({
      receiptReference: "APP-ENG-001-A1B2",
      message: PUBLIC_APPLICATION_SUCCESS_MESSAGE,
    });
  });

  it("never exposes UUID-looking references", () => {
    expect(
      toSafePublicReceipt({
        receiptReference: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toEqual({
      receiptReference: "RECEIVED",
      message: PUBLIC_APPLICATION_SUCCESS_MESSAGE,
    });
  });

  it("defaults missing references to RECEIVED", () => {
    expect(toSafePublicReceipt({})).toEqual({
      receiptReference: "RECEIVED",
      message: PUBLIC_APPLICATION_SUCCESS_MESSAGE,
    });
  });
});
