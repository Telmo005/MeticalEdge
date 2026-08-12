import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Substitui o conteúdo normal das telas de análise (Painel, Livro,
 * Simulação, Comerciantes) enquanto não houver capital configurado — sem
 * isso o sistema não tem nada real para avaliar, e mostrar tabelas vazias
 * ou avisos genéricos só confunde quem está a abrir a app pela primeira
 * vez. Força a passagem por /settings antes de mostrar o resto.
 */
export function OnboardingWelcome() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--sidebar-bg)]">
          <TrendingUp className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <CardTitle className="text-base">Bem-vindo ao MeticalEdge</CardTitle>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Antes de começar a vigiar o mercado, precisamos de saber com quanto capital vais trabalhar. É o
          único passo que falta — o resto o sistema faz sozinho a partir daqui.
        </p>
        <Link href="/settings" className="mt-5 inline-block">
          <Button>Definir capital inicial</Button>
        </Link>
      </Card>
    </div>
  );
}
