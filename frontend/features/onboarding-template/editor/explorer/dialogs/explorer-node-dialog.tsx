"use client";

import { useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;

  title: string;

  label: string;

  onClose(): void;

  onSave(value: string): void;
}

export function ExplorerNodeDialog({ open, title, label, onClose, onSave }: Props) {
  const [value, setValue] = useState("");

  return (
    <FormSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={title}
      description={label}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(value);
              setValue("");
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <Input value={value} placeholder={label} onChange={(event) => setValue(event.target.value)} />
    </FormSheet>
  );
}
