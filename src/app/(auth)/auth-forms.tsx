"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { signIn, signUp, type FormState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action}>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

export function SignUpForm({ invite }: { invite?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  return (
    <form action={action}>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="invite" value={invite ?? ""} />
      <Field label="Seu nome" hint="Como você quer ser chamado no app.">
        <Input name="name" autoComplete="given-name" required />
      </Field>
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha" hint="Pelo menos 8 caracteres.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
