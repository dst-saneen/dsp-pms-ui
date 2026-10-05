import { ReactNode } from "react";

import { RequiredLabel } from "./required-label";

interface FormFieldProps {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required = false,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={className ?? "space-y-2"}>
      <RequiredLabel required={required}>
        {label}
      </RequiredLabel>

      {children}
    </div>
  );
}