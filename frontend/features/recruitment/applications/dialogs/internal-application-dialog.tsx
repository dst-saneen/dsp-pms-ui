"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { LookupSelect, RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PUBLIC_CV_ACCEPT } from "../../careers/constants/public-careers-content";
import { validatePublicDocument } from "../../careers/utils/file-validation";
import { JOB_OPENING_STATUS } from "../../types/enums";
import { useJobOpenings } from "../../openings/hooks/use-job-openings";

import { useCreateInternalApplication } from "../hooks/use-job-applications";
import {
  internalApplicationSchema,
  type InternalApplicationFormValues,
} from "../validation/application-schema";

interface InternalApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOpeningId?: string;
  onCreated?: (applicationId: string) => void;
}

export function InternalApplicationDialog(props: InternalApplicationDialogProps) {
  const key = props.open
    ? `open:${props.defaultOpeningId ?? ""}`
    : "closed";

  return <InternalApplicationDialogContent key={key} {...props} />;
}

function InternalApplicationDialogContent({
  open,
  onOpenChange,
  defaultOpeningId,
  onCreated,
}: InternalApplicationDialogProps) {
  const createMutation = useCreateInternalApplication();
  const openingsQuery = useJobOpenings({ status: JOB_OPENING_STATUS.OPEN });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);

  const openingItems =
    openingsQuery.data?.map((opening) => ({
      id: opening.id,
      code: opening.openingCode,
      name: opening.title,
    })) ?? [];

  const form = useForm<InternalApplicationFormValues>({
    resolver: zodResolver(internalApplicationSchema),
    defaultValues: {
      jobOpeningId: defaultOpeningId ?? "",
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      coverNote: "",
    },
  });

  const jobOpeningId = useWatch({
    control: form.control,
    name: "jobOpeningId",
  });

  const handleSubmit = async (values: InternalApplicationFormValues) => {
    if (cvFile) {
      const validationError = validatePublicDocument(cvFile, { label: "CV" });
      if (validationError) {
        setCvError(validationError);
        return;
      }
    }

    const application = await createMutation.mutateAsync({
      ...values,
      mobile: values.mobile?.trim() || undefined,
      coverNote: values.coverNote?.trim() || undefined,
      cvFile: cvFile ?? undefined,
    });
    onOpenChange(false);
    onCreated?.(application.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Internal candidate entry</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="space-y-2">
            <RequiredLabel>Job opening</RequiredLabel>
            <LookupSelect
              value={jobOpeningId}
              onChange={(value) => form.setValue("jobOpeningId", value)}
              items={openingItems}
              loading={openingsQuery.isLoading}
              placeholder="Select open job opening"
              clearable={false}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel>First name</RequiredLabel>
              <Input {...form.register("firstName")} />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Last name</RequiredLabel>
              <Input {...form.register("lastName")} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel>Email</RequiredLabel>
              <Input type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mobile</label>
              <Input {...form.register("mobile")} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cover note</label>
            <Textarea rows={3} {...form.register("coverNote")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CV (optional)</label>
            <Input
              type="file"
              accept={PUBLIC_CV_ACCEPT}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setCvFile(file);
                setCvError(
                  file
                    ? validatePublicDocument(file, { label: "CV" })
                    : null,
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              PDF, DOC, or DOCX · up to 10 MB. File is scanned for malware on upload.
            </p>
            {cvFile ? (
              <p className="text-xs text-muted-foreground">Selected: {cvFile.name}</p>
            ) : null}
            {cvError ? (
              <p className="text-sm text-destructive">{cvError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || Boolean(cvError)}
            >
              {createMutation.isPending ? "Creating…" : "Create application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
