import Link from "next/link";
import { Card, Page } from "@/components/ui";
import { SignUpForm } from "../auth-forms";

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const { convite } = await searchParams;
  const invite = typeof convite === "string" ? convite : undefined;
  return (
    <Page title="Criar conta">
      <Card>
        <SignUpForm invite={invite} />
      </Card>
      <p className="text-muted">
        Já tem conta? <Link href="/entrar" className="text-primary underline">Entrar</Link>
      </p>
    </Page>
  );
}
