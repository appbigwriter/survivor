import Link from "next/link";
import { Card, Notice, Page } from "@/components/ui";
import { SignInForm } from "../auth-forms";

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const { desativada } = await searchParams;
  return (
    <Page title="Entrar no Survivor">
      {desativada && (
        <Notice tone="error">Sua conta está desativada. Fale com quem enviou o convite.</Notice>
      )}
      <Card>
        <SignInForm />
      </Card>
      <p className="text-muted">
        Ainda não tem conta? O cadastro é feito pelo link de convite que você recebeu.
      </p>
      <p className="mt-4 text-sm text-muted">
        <Link href="/privacidade" className="underline">Privacidade</Link> ·{" "}
        <Link href="/termos" className="underline">Termos de uso</Link>
      </p>
    </Page>
  );
}
