"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";
import { cn } from "@/lib/utils";

/**
 * Botão de submit cujo estado de "a processar" cobre a página inteira (ver
 * ProcessingOverlay), não só o próprio botão — essencial quando quem usa
 * isto não é técnico: sem isto, um clique que demora 1-2s a gravar na base
 * de dados parece que não fez nada, e a tentação é clicar outra vez (o que
 * pode duplicar a operação registada).
 */
export function SubmitButton({
  children,
  pendingText,
  className,
  variant = "primary",
  disabled = false,
  formAction,
  confirmMessage,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Bloqueia a submissão enquanto o formulário estiver incompleto — sem
   *  isto era possível gravar operações com zeros, que ficavam para sempre
   *  no histórico a estragar a taxa de sucesso e o lucro médio. */
  disabled?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Se definido, pede confirmação nativa antes de submeter — para ações
   *  que desfazem trabalho manual (ex.: repor valores recomendados). */
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <ProcessingOverlay show={pending} message={pendingText} />
      <Button
        type="submit"
        variant={variant}
        formAction={formAction}
        disabled={pending || disabled}
        className={cn(className)}
        onClick={(e) => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            e.preventDefault();
          }
        }}
      >
        {children}
      </Button>
    </>
  );
}
