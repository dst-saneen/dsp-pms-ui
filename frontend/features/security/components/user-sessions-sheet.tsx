"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { securityService } from "@/features/security/security.service";
import type { SecurityUser } from "@/features/security/types";
import { getApiErrorMessage } from "@/services/api-client";

interface UserSessionsSheetProps {
  user: SecurityUser | null;
  canManage: boolean;
  onClose: () => void;
}

export function UserSessionsSheet({
  user,
  canManage,
  onClose,
}: UserSessionsSheetProps) {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["security-user-sessions", user?.id],
    queryFn: () => securityService.userSessions(user?.id ?? ""),
    enabled: Boolean(user),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: ({
      userId,
      sessionId,
    }: {
      userId: string;
      sessionId: string;
    }) => securityService.revokeUserSession(userId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["security-user-sessions", user?.id],
      });
      toast.success("Session revoked.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <FormSheet
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Active sessions"
      description={
        user
          ? `Review and revoke active sessions for ${user.displayName ?? user.username}.`
          : undefined
      }
      size="md"
    >
      {sessionsQuery.isLoading ? (
        <div className="text-muted-foreground flex min-h-32 items-center justify-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          Loading sessions…
        </div>
      ) : sessionsQuery.isError ? (
        <p className="text-destructive text-sm">
          {getApiErrorMessage(sessionsQuery.error)}
        </p>
      ) : sessionsQuery.data?.length ? (
        <div className="space-y-3">
          {sessionsQuery.data.map((session) => (
            <div key={session.id} className="border-border rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    Started{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(session.createdAt))}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Last active{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(session.lastActivityAt))}
                  </p>
                </div>
                {canManage && user ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokeSessionMutation.isPending}
                    onClick={() =>
                      revokeSessionMutation.mutate({
                        userId: user.id,
                        sessionId: session.id,
                      })
                    }
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">
          No active sessions.
        </p>
      )}
    </FormSheet>
  );
}
