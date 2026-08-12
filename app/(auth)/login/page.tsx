import { signInAction } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label } from "@/components/ui/input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8">
        <h1 className="mb-1 text-lg font-semibold">MeticalEdge</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">Monitor de oportunidades USDT/MZN</p>

        {error ? (
          <p className="mb-4 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical)]">
            {error}
          </p>
        ) : null}

        <form action={signInAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <SubmitButton pendingText="A entrar..." className="mt-2 w-full justify-center">
            Entrar
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
