"use client";

import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { createToken, type TokenState } from "./actions";

/** Gera o código pessoal e mostra uma única vez, com um botão para copiar. */
export function TokenBox({ hasToken }: { hasToken: boolean }) {
  const [state, action, pending] = useActionState<TokenState, FormData>(async () => createToken(), {});
  const [copied, setCopied] = useState(false);

  if (state.token) {
    return (
      <div className="pop">
        <p className="mb-2 font-semibold">Seu código pessoal</p>
        <p className="mb-3 select-all break-all rounded-2xl border-2 border-primary bg-primary-soft p-4 font-mono text-lg">{state.token}</p>
        <Button
          type="button"
          className="mb-3 w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.token!);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "✓ Copiado" : "Copiar código"}
        </Button>
        <p className="text-muted">
          Ele aparece só agora. Cole no atalho, no cabeçalho Authorization, e não compartilhe: quem tiver o código consegue enviar dados para a sua
          conta.
        </p>
      </div>
    );
  }

  return (
    <form action={action}>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Gerando…" : hasToken ? "Gerar um código novo" : "Gerar meu código"}
      </Button>
      {hasToken && <p className="mt-2 text-sm text-muted">O código antigo para de funcionar e o atalho precisa receber o novo.</p>}
    </form>
  );
}
