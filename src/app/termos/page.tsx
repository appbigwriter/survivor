import { Card, Page } from "@/components/ui";

export default function TermsPage() {
  return (
    <Page title="Termos de uso" back="/">
      <Card>
        <div className="space-y-4">
          <p>
            O Survivor é oferecido de graça, por convite, para acompanhamento pessoal de
            alimentação, caminhada e treino.
          </p>
          <h2 className="text-lg font-semibold">Não é atendimento de saúde</h2>
          <p>
            O app é uma ferramenta educativa e de acompanhamento. As metas e os programas são
            calculados por regras gerais e não substituem a avaliação de médico, nutricionista ou
            profissional de educação física. Procure um médico antes de começar qualquer programa de
            exercício ou dieta, principalmente se você tem doença crônica, toma remédios ou tem mais
            de 60 anos.
          </p>
          <p>
            O app nunca indica mudar ou parar um remédio. Qualquer ajuste de dose deve ser feito pelo
            seu médico.
          </p>
          <h2 className="text-lg font-semibold">Pare se sentir algo</h2>
          <p>
            Interrompa o exercício e procure atendimento se sentir dor no peito, falta de ar fora do
            normal, tontura forte, desmaio ou palpitações.
          </p>
          <h2 className="text-lg font-semibold">Precisão</h2>
          <p>
            Calorias e nutrientes são estimativas. A identificação de alimentos por inteligência
            artificial pode errar: confira os itens antes de salvar.
          </p>
          <h2 className="text-lg font-semibold">Conta</h2>
          <p>
            A conta é pessoal. O administrador pode desativar contas, por exemplo, de quem não faz
            mais parte do grupo convidado.
          </p>
        </div>
      </Card>
    </Page>
  );
}
