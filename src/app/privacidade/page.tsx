import { Card, Page } from "@/components/ui";

// Lê o nome do responsável em tempo de execução (variável do Easypanel).
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const controller = process.env.DATA_CONTROLLER_NAME || "o administrador do Survivor";
  const contact = process.env.DATA_CONTROLLER_CONTACT;
  return (
    <Page title="Política de privacidade" back="/">
      <Card>
        <div className="space-y-4">
          <p>
            Esta política explica como o Survivor trata os seus dados, de acordo com a Lei Geral de
            Proteção de Dados (Lei 13.709/2018).
          </p>
          <h2 className="text-lg font-semibold">Quem é o responsável</h2>
          <p>
            O controlador dos dados é {controller}.
            {contact ? ` Contato: ${contact}.` : ""}
          </p>
          <h2 className="text-lg font-semibold">Quais dados coletamos</h2>
          <p>
            Nome, e-mail, sexo, data de nascimento, altura, peso, cintura, objetivo, respostas da
            triagem de saúde, remédios, pressão arterial, sintomas, refeições, passos e treinos.
            Dados de saúde são dados pessoais sensíveis e só são tratados com o seu consentimento
            específico.
          </p>
          <h2 className="text-lg font-semibold">Para que usamos</h2>
          <p>
            Para calcular suas metas diárias, mostrar sua evolução, gerar avisos de segurança e
            produzir relatórios para você levar ao seu médico. Não vendemos nem compartilhamos seus
            dados para publicidade.
          </p>
          <h2 className="text-lg font-semibold">Com quem compartilhamos</h2>
          <p>
            As descrições e fotos de refeições são enviadas ao serviço de inteligência artificial
            configurado no sistema, apenas para identificar os alimentos. O administrador vê só
            números gerais e anônimos. Nenhum outro usuário vê seus dados.
          </p>
          <h2 className="text-lg font-semibold">Onde ficam e por quanto tempo</h2>
          <p>
            Num servidor próprio do Survivor, com acesso restrito. Fotos de refeições são apagadas
            depois de 90 dias. Os demais dados ficam guardados enquanto sua conta existir.
          </p>
          <h2 className="text-lg font-semibold">Seus direitos</h2>
          <p>
            Você pode baixar todos os seus dados e apagar sua conta a qualquer momento na tela
            Conta. Apagar a conta remove todos os seus registros de forma definitiva. Você também
            pode retirar o consentimento, o que encerra o uso do app.
          </p>
        </div>
      </Card>
    </Page>
  );
}
