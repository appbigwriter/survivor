"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { deleteAccount, type DeleteState } from "./actions";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  return (
    <form action={action}>
      <p className="mb-3">
        Isso apaga sua conta e todos os seus registros de forma definitiva: peso, refeições,
        remédios, pressão e metas. Não dá para desfazer.
      </p>
      <Field label="Para confirmar, digite APAGAR">
        <Input name="confirm" autoComplete="off" required />
      </Field>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" variant="danger" disabled={pending} className="w-full">
        {pending ? "Apagando..." : "Apagar minha conta"}
      </Button>
    </form>
  );
}
