import { cn } from "@/lib/utils";
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent-2)]",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-medium uppercase tracking-wide text-[var(--muted)]", className)}
      {...props}
    />
  );
}

/** Mesmas classes do Input — só para os <select> e <textarea> soltos pelos
 *  formulários deixarem de ter cada um o seu conjunto de classes copiado à
 *  mão, que era como acabavam ligeiramente diferentes uns dos outros. */
const FIELD_CLASSES =
  "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent-2)]";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_CLASSES, className)} {...props} />;
}

/** Campo com a unidade colada à direita ("MZN", "MZN/USDT"). Sem isto é
 *  preciso ler o rótulo para saber se um número é um preço ou um total —
 *  e trocar os dois é o erro mais fácil de cometer nestes formulários. */
export function InputWithSuffix({
  suffix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix: string }) {
  return (
    <div className="relative">
      <Input className={cn("pr-24", className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] uppercase tracking-wide text-[var(--muted)]">
        {suffix}
      </span>
    </div>
  );
}

/** Texto de apoio por baixo de um campo. */
export function FieldHint({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "critical";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs",
        tone === "critical" ? "text-[var(--critical)]" : "text-[var(--muted)]",
        className
      )}
    >
      {children}
    </p>
  );
}
