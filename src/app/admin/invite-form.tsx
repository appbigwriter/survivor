"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { createInvite, type AdminState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createInvite, {});
  return (
    <form action={action}>
      <Field label="Para quem (opcional)" hint="Só para você lembrar. Ex.: Bloco B, ou o nome da pessoa.">
        <Input name="label" maxLength={60} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantas pessoas">
          <Input name="max_uses" type="number" min={1} max={500} defaultValue={1} required />
        </Field>
        <Field label="Validade (dias)">
          <Input name="days" type="number" min={1} max={365} defaultValue={14} required />
        </Field>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="info">{state.ok}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">Criar convite</Button>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg border border-border px-3 py-1 text-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copiado" : "Copiar link"}
    </button>
  );
}
