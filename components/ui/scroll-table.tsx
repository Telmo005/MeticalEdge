import { cn } from "@/lib/utils";

/**
 * Envolve uma <table> com scroll próprio (vertical E horizontal) em vez de
 * deixar a tabela esticar a página inteira — importante no livro de ofertas,
 * que pode ter dezenas de linhas. O cabeçalho da tabela (<thead>) deve levar
 * `sticky top-0` para continuar visível ao rolar.
 */
export function ScrollTable({
  children,
  className,
  // Acompanha a altura do ecrã em vez de um valor fixo pequeno — num
  // monitor alto sobrava muito espaço em branco por baixo da tabela; num
  // telemóvel o `vh` reduz sozinho. O tecto em rem evita crescer demais em
  // ecrãs enormes.
  maxHeight = "min(68vh, 44rem)",
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div
      className={cn("overflow-auto rounded-lg border border-[var(--border)]", className)}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}
