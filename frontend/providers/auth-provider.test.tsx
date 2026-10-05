import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

vi.mock("@/services/auth.service", () => ({
  authService: {
    restore: vi.fn(),
    login: vi.fn(),
  },
}));

import { authService } from "@/services/auth.service";

import { AuthProvider, useAuth } from "./auth-provider";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const authenticatedResponse = {
  accessToken: "access-token",
  user: { id: "user-id" },
} as never;

let currentPathname = "/dashboard";

function StatusProbe({
  showLogin = false,
  onSignedIn,
}: {
  showLogin?: boolean;
  onSignedIn?: () => void;
}) {
  const { login, status } = useAuth();

  return (
    <>
      <output aria-label="authentication status">{status}</output>
      {showLogin ? (
        <button
          onClick={() => {
            void login("owner@example.test", "password").then(() => onSignedIn?.());
          }}
        >
          Sign in
        </button>
      ) : null}
    </>
  );
}

function renderProvider(children: ReactNode, { strict = false }: { strict?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const provider = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  return render(strict ? <StrictMode>{provider}</StrictMode> : provider);
}

function AnonymousLoginRouteHarness() {
  const [, setRouteVersion] = useState(0);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusProbe
          showLogin
          onSignedIn={() => {
            currentPathname = "/dashboard";
            setRouteVersion(1);
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("AuthProvider session restoration", () => {
  beforeEach(() => {
    currentPathname = "/dashboard";
    vi.mocked(usePathname).mockImplementation(() => currentPathname);
    vi.mocked(authService.restore).mockReset();
    vi.mocked(authService.login).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shares one restore request across a Strict Mode effect replay", async () => {
    const restore = deferred<typeof authenticatedResponse>();
    vi.mocked(authService.restore).mockReturnValue(restore.promise);

    renderProvider(<StatusProbe />, { strict: true });

    expect(authService.restore).toHaveBeenCalledTimes(1);

    await act(async () => {
      restore.resolve(authenticatedResponse);
      await restore.promise;
    });

    await waitFor(() =>
      expect(screen.getByLabelText("authentication status")).toHaveTextContent("authenticated")
    );
  });

  it("does not let an earlier restore failure clear a completed login", async () => {
    const restore = deferred<typeof authenticatedResponse>();
    vi.mocked(authService.restore).mockReturnValue(restore.promise);
    vi.mocked(authService.login).mockResolvedValue(authenticatedResponse);

    renderProvider(<StatusProbe showLogin />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByLabelText("authentication status")).toHaveTextContent("authenticated")
    );

    await act(async () => {
      restore.reject(new Error("stale unauthenticated restore"));
      try {
        await restore.promise;
      } catch {
        // The provider owns this expected failure path.
      }
    });

    expect(screen.getByLabelText("authentication status")).toHaveTextContent("authenticated");
  });

  it("ignores a restore rejection that races a successful login before effect cleanup", async () => {
    const restore = deferred<typeof authenticatedResponse>();
    vi.mocked(authService.restore).mockReturnValue(restore.promise);
    vi.mocked(authService.login).mockResolvedValue(authenticatedResponse);

    renderProvider(<StatusProbe showLogin />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await Promise.resolve();
      restore.reject(new Error("same-batch stale restore failure"));
      try {
        await restore.promise;
      } catch {
        // The restore's own callback observes the failed promise.
      }
    });

    await waitFor(() =>
      expect(screen.getByLabelText("authentication status")).toHaveTextContent("authenticated")
    );
  });

  it("does not restore again after a login begun on an anonymous route", async () => {
    vi.mocked(authService.login).mockResolvedValue(authenticatedResponse);
    currentPathname = "/careers";

    render(<AnonymousLoginRouteHarness />);
    expect(authService.restore).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByLabelText("authentication status")).toHaveTextContent("authenticated")
    );
    expect(authService.restore).not.toHaveBeenCalled();
  });
});
