import Link from "next/link";
import { BottomNav, Button, Card, LinkButton, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { signOut } from "../(auth)/actions";
import { DeleteAccountForm } from "./delete-form";

export default async function AccountPage() {
  const profile = await requireOnboarded();
  return (
    <Page title="Conta">
      <Card title={profile.display_name}>
        <div className="flex flex-col gap-3">
          <LinkButton href="/metas" variant="secondary">Minhas metas</LinkButton>
          <LinkButton href="/anamnese" variant="secondary">Atualizar meus dados e remédios</LinkButton>
          <form action={signOut}>
            <Button type="submit" variant="secondary" className="w-full">Sair</Button>
          </form>
        </div>
      </Card>

      <Card title="Meus dados">
        <p className="mb-3">
          Baixe uma cópia de tudo o que o Survivor guarda sobre você, num arquivo JSON.
        </p>
        <a
          href="/conta/exportar"
          className="inline-flex min-h-12 items-center rounded-xl border border-border px-5 font-semibold"
        >
          Baixar meus dados
        </a>
        <p className="mt-3 text-sm text-muted">
          <Link href="/privacidade" className="underline">Política de privacidade</Link> ·{" "}
          <Link href="/termos" className="underline">Termos de uso</Link>
        </p>
      </Card>

      <Card title="Apagar conta">
        <DeleteAccountForm />
      </Card>
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
