import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/api-client";

import { HrOperationsApiService } from "./hr-operations-api.service";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
  unwrapApiData: (payload: { data: unknown }) => payload.data,
}));

describe("HrOperationsApiService.listAllRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads every employee request page without dropping older records", async () => {
    const firstPageItems = Array.from({ length: 100 }, (_, index) => ({
      id: `request-${index + 1}`,
    }));
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: firstPageItems,
            total: 101,
            page: 1,
            limit: 100,
            allowedActions: ["CREATE"],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: [{ id: "request-101" }],
            total: 101,
            page: 2,
            limit: 100,
            allowedActions: ["CREATE"],
          },
        },
      });

    const result = await HrOperationsApiService.listAllRequests({
      employeeId: "employee-1",
    });

    expect(result.items).toHaveLength(101);
    expect(result.allowedActions).toEqual(["CREATE"]);
    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      { params: { employeeId: "employee-1", page: 1, limit: 100 } },
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      { params: { employeeId: "employee-1", page: 2, limit: 100 } },
    );
  });
});

describe("HrOperationsApiService.listClearanceQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads every assigned clearance page so local filters cannot hide later rows", async () => {
    const firstPageItems = Array.from({ length: 100 }, (_, index) => ({
      id: `clearance-${index + 1}`,
    }));
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: firstPageItems,
            total: 101,
            page: 1,
            limit: 100,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: [{ id: "clearance-101" }],
            total: 101,
            page: 2,
            limit: 100,
          },
        },
      });

    const result = await HrOperationsApiService.listClearanceQueue();

    expect(result.items).toHaveLength(101);
    expect(result.total).toBe(101);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, expect.any(String), {
      params: { queue: "mine", page: 1, limit: 100 },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, expect.any(String), {
      params: { queue: "mine", page: 2, limit: 100 },
    });
  });
});
