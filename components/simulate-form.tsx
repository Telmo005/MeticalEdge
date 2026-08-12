"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";

export function SimulateForm({ defaultCapital }: { defaultCapital: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(String(defaultCapital));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(`/simulacao?capital=${encodeURIComponent(value)}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <ProcessingOverlay show={isPending} message="A simular..." />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capital">Simular com quanto capital (MZN)?</Label>
        <Input
          id="capital"
          name="capital"
          type="number"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full sm:w-48"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        Simular
      </Button>
    </form>
  );
}
