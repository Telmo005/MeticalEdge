import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Mesmo cartão de "ainda não há nada" que a app já usava, mas com um sítio
 *  para pôr uma acção — os estados vazios anteriores deixavam a pessoa sem
 *  saber o que fazer a seguir. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      {title ? <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p> : null}
      {description ? (
        <p className={cn("text-sm text-[var(--muted)]", title && "mt-1")}>{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}
