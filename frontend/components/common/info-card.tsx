import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
  description?: string;
  className?: string;
}

export function InfoCard({
  title,
  children,
  description,
  className,
}: InfoCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle>{title}</CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>

      <CardContent>{children}</CardContent>
    </Card>
  );
}
