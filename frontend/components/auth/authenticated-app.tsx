"use client";

import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { organizationOnboardingService } from "@/features/organization-onboarding/organization-onboarding-service";
import {
  appendNextQuery,
  consumePostAuthDestination,
  peekAuthNext,
  resolveSafeNextPath,
} from "@/lib/auth-next-path";
import { useAuth } from "@/providers/auth-provider";

export function AuthenticatedApp({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const isOrganizationOwner = Boolean(
    user?.authorization.roles.includes("ORGANIZATION_OWNER")
  );
  const onboardingQuery = useQuery({
    queryKey: [
      "organization-onboarding",
      user?.authorization.activeCompanyGroupId,
    ],
    queryFn: organizationOnboardingService.status,
    enabled:
      status === "authenticated" &&
      Boolean(user) &&
      !user?.mustChangePassword &&
      isOrganizationOwner,
    retry: 1,
  });
  const onboardingIncomplete =
    onboardingQuery.data?.status === "IN_PROGRESS";
  const intendedNext = resolveSafeNextPath(peekAuthNext());

  useEffect(() => {
    if (status === "unauthenticated") {
      const nextPath =
        pathname.startsWith("/login") || pathname.startsWith("/register")
          ? undefined
          : pathname;
      router.replace(appendNextQuery("/login", nextPath));
      return;
    }

    if (
      status === "authenticated" &&
      user?.mustChangePassword &&
      pathname !== "/change-password"
    ) {
      router.replace(appendNextQuery("/change-password", intendedNext));
      return;
    }

    if (
      status === "authenticated" &&
      isOrganizationOwner &&
      onboardingQuery.isSuccess
    ) {
      if (onboardingIncomplete && pathname !== "/onboarding") {
        router.replace("/onboarding");
      } else if (!onboardingIncomplete && pathname === "/onboarding") {
        router.replace(consumePostAuthDestination());
      }
    }
  }, [
    intendedNext,
    isOrganizationOwner,
    onboardingIncomplete,
    onboardingQuery.isSuccess,
    pathname,
    router,
    status,
    user?.mustChangePassword,
  ]);

  if (
    status !== "authenticated" ||
    !user ||
    user.mustChangePassword ||
    (isOrganizationOwner && onboardingQuery.isPending) ||
    (isOrganizationOwner &&
      onboardingQuery.isSuccess &&
      ((onboardingIncomplete && pathname !== "/onboarding") ||
        (!onboardingIncomplete && pathname === "/onboarding")))
  ) {
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Securing your workspace…
        </div>
      </div>
    );
  }

  if (isOrganizationOwner && onboardingQuery.isError) {
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold">
            Organization setup could not be verified
          </h1>
          <p className="text-muted-foreground text-sm">
            Check the backend connection, then try again. If this keeps
            appearing, sign out and sign in again.
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => void onboardingQuery.refetch()}>
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void logout().then(() => {
                  router.replace("/login");
                });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
