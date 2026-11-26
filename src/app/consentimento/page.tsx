import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, Page } from "@/components/ui";
import { hasCurrentConsent, requireProfile } from "@/lib/auth";
import { acceptConsent } from "./actions";

export default async function ConsentPage() {
  await requireProfile();
  if (await hasCurrentConsent()) redirect("/");

  return (
    <Page title="Antes de começar">
      <Card title="O que o Survivor guarda">
        <ul className="list-disc space-y-2 pl-5">
          <li>Seus dados do corpo: idade, altura, peso, cintura e pressão.</li>
          <li>Suas respostas sobre saúde e os remédios que você informar.</li>
          <li>O que você come, os passos e os treinos.</li>
          <li>Seus horários e a qualidade do sono, as respostas do questionário de apneia e, se usar o jejum, as respostas da triagem de jejum.</li>
        </ul>
        <p className="mt-3">
          Esses dados servem só para calcular suas metas e mostrar sua evolução. Só você vê seus
          dados. O administrador vê apenas números gerais e anônimos, como quantas pessoas usam o
          app.
        </p>
        <p className="mt-3">
          Quando você registra uma refeição por texto ou foto, a descrição é enviada a um serviço de
          inteligência artificial para identificar os alimentos. Você pode baixar ou apagar todos os
          seus dados quando quiser, na tela Conta.
        </p>
        <p className="mt-3">
          O Survivor é uma ferramenta educativa e de acompanhamento. Ele não substitui médico,
          nutricionista ou profissional de educação física.
        </p>
      </Card>

      <form action={acceptConsent}>
        <Card>
          <label className="mb-4 flex gap-3">
            <input type="checkbox" name="terms" required className="mt-1 size-6" />
            <span>
              Li e aceito os <Link href="/termos" className="text-primary underline">termos de uso</Link> e
              a <Link href="/privacidade" className="text-primary underline">política de privacidade</Link>.
            </span>
          </label>
          <label className="mb-4 flex gap-3">
            <input type="checkbox" name="health" required className="mt-1 size-6" />
            <span>
              Autorizo o tratamento dos meus dados de saúde (peso, pressão, alimentação, remédios, sono,
              respostas de saúde e dos questionários de apneia e de jejum) para as finalidades descritas acima, como prevê o artigo 11 da LGPD.
            </span>
          </label>
          <Button type="submit" className="w-full">Concordo e quero continuar</Button>
        </Card>
      </form>
      <p className="mt-4 text-center">
        <Link href="/conta" className="text-muted underline">Não quero continuar: sair ou apagar minha conta</Link>
      </p>
    </Page>
  );
}
