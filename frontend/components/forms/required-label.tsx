import { cn } from "@/lib/utils";

interface RequiredLabelProps {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
}

export function RequiredLabel({
  children,
  required = false,
  className,
  htmlFor,
}: RequiredLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-sm font-medium leading-none",
        className
      )}
    >
      {children}

      {required && (
        <span className="ml-1 text-destructive">*</span>
      )}
    </label>
  );
}
