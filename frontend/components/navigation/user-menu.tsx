"use client";

import { useState } from "react";
import {
  ChevronDown,
  Laptop,
  LoaderCircle,
  LogOut,
  MonitorOff,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { useAuth } from "@/providers/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authService } from "@/services/auth.service";
import { getApiErrorMessage } from "@/services/api-client";

export function UserMenu() {
  const { user, logout, logoutAll } = useAuth();
  const { setVersion, version } = useSidebar();
  const [busy, setBusy] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: authService.sessions,
    enabled: sessionsOpen,
  });
  const revokeMutation = useMutation({
    mutationFn: authService.revokeSession,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["auth-sessions"] }),
  });

  if (!user) {
    return null;
  }

  const initials = user.username.slice(0, 2).toUpperCase();

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-9 gap-2 px-1.5 sm:px-2"
            aria-label="Open account menu"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
              {user.username}
            </span>
            <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-0.5 px-2 py-2">
            <span className="block truncate text-sm font-semibold text-foreground">
              {user.username}
            </span>
            <span className="block truncate text-xs font-normal">
              {user.email ?? user.authorization.roles.join(", ")}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="sm:hidden">Sidebar navigation</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={version}
            onValueChange={(value) => {
              if (value === "v1" || value === "v2") setVersion(value);
            }}
            className="sm:hidden"
          >
            <DropdownMenuRadioItem value="v1">V1 Classic</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="v2">V2 Grouped</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator className="sm:hidden" />
          <DropdownMenuItem
            onSelect={() => setSessionsOpen(true)}
            className="gap-2 px-2 py-2"
          >
            <Laptop className="size-4" />
            Active sessions
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onSelect={() => void run(logout)}
            className="gap-2 px-2 py-2"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onSelect={() => void run(logoutAll)}
            className="gap-2 px-2 py-2 text-destructive focus:text-destructive"
          >
            <MonitorOff className="size-4" />
            Sign out all devices
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Active sessions</DialogTitle>
            <DialogDescription>
              Review active sessions and revoke any session you no longer
              recognize.
            </DialogDescription>
          </DialogHeader>

          {sessionsQuery.isLoading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading sessions…
            </div>
          ) : sessionsQuery.isError ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {getApiErrorMessage(sessionsQuery.error)}
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {(sessionsQuery.data ?? []).map((session) => {
                const current = session.id === user.sessionId;
                const revoked = Boolean(session.revokedAt);

                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Laptop className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {current ? "This session" : "Signed-in session"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last used{" "}
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(session.lastActivityAt))}
                      </p>
                    </div>
                    {revoked ? (
                      <span className="text-xs text-muted-foreground">
                        Revoked
                      </span>
                    ) : current ? (
                      <span className="text-xs font-medium text-success">
                        Current
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(session.id)}
                        aria-label="Revoke session"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
