"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRoundSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/providers/auth-provider";
import { InternalApplicationDialog } from "@/features/recruitment/applications/dialogs/internal-application-dialog";
import { RECRUITMENT_PERMISSIONS } from "@/features/recruitment/constants/permissions";
import { RECRUITMENT_ROUTES } from "@/features/recruitment/constants/routes";

interface RecruitCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecruitCandidateDialog({ open, onOpenChange }: RecruitCandidateDialogProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);

  const [intakeOpen, setIntakeOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRoundSearch className="size-4" aria-hidden />
              Recruit candidate
            </DialogTitle>
            <DialogDescription>
              New hires enter through Recruitment. Choose how you want to start the hiring
              process.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                router.push(RECRUITMENT_ROUTES.openings.list);
              }}
            >
              Browse job openings
            </Button>
            {canManage ? (
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  setIntakeOpen(true);
                }}
              >
                Submit internal application
              </Button>
            ) : null}
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                router.push(RECRUITMENT_ROUTES.applications.list);
              }}
            >
              View applications pipeline
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InternalApplicationDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        onCreated={(applicationId) => {
          router.push(RECRUITMENT_ROUTES.applications.detail(applicationId));
        }}
      />
    </>
  );
}
