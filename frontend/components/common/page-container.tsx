import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col gap-5 md:gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}