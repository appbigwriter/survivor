import { headers } from "next/headers";
import { BottomNav, Button, Card, Notice, Page } from "@/components/ui";
import { isMissingTable } from "@/lib/accounts";
import { requireOnboarded } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revokeToken } from "./actions";
import { TokenBox } from "./token-box";

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export default async function PhonePage() {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("device_tokens").select("created_at, last_used_at").maybeSingle();
  const ready = !(error && isMissingTable(error));
  const h = await headers();
  const base = process.env.APP_URL || `https://${h.get("host") ?? "seu-endereco"}`;
  const endpoint = `${base.replace(/\/$/, "")}/api/saude`;

  return (
    <Page title="Conectar o iPhone" back="/conta">
      {!ready && <Notice tone="info">A conexão com o iPhone ainda não está disponível neste servidor.</Notice>}

      <Card index={0}>
        <p className="mb-3">
          Um atalho do iPhone pode ler o app Saúde e mandar para o Survivor, sozinho, seus passos, a distância, a energia gasta, o peso
          da balança e os treinos do relógio. Assim você não precisa digitar.
        </p>
        <p className="text-muted">Funciona só no iPhone. No Android, continue registrando à mão na tela Hoje.</p>
      </Card>

      {ready && (
        <Card index={1} title="Seu código pessoal">
          {data && (
            <p className="mb-4 rounded-2xl bg-surface-2 p-3">
              {data.last_used_at ? (
                <>
                  <span className="font-semibold text-primary">✓ Conectado.</span> Último envio: {when(data.last_used_at)}.
                </>
              ) : (
                <>Código criado em {when(data.created_at)}. Ainda não recebemos nenhum envio.</>
              )}
            </p>
          )}
          <TokenBox hasToken={Boolean(data)} />
          {data && (
            <form action={revokeToken} className="mt-3">
              <Button type="submit" variant="danger" className="w-full">
                Desconectar o iPhone
              </Button>
            </form>
          )}
        </Card>
      )}

      <Card index={2} title="Montar o atalho no iPhone">
        <ol className="list-decimal space-y-4 pl-5">
          <li>
            Abra o app <strong>Atalhos</strong>, toque em <strong>+</strong> e dê o nome <strong>Survivor</strong>.
          </li>
          <li>
            Adicione <strong>Encontrar Amostras de Saúde</strong>: tipo <em>Passos</em>, data de início <em>hoje</em>. Depois
            adicione <strong>Calcular Estatísticas</strong> com <em>Soma</em>. Repita para <em>Distância de Caminhada + Corrida</em>{" "}
            e <em>Energia Ativa</em>.
          </li>
          <li>
            Para o peso: <strong>Encontrar Amostras de Saúde</strong> com tipo <em>Peso</em>, ordenado pela data mais recente, limite
            1. Pegue também a <em>data de início</em> dessa amostra, formatada como <em>ISO 8601</em>: assim o Survivor sabe quando você
            se pesou e não repete uma pesagem antiga.
          </li>
          <li>
            Adicione <strong>Formatar Data</strong> com a data atual no formato personalizado <code>yyyy-MM-dd</code>.
          </li>
          <li>
            Adicione <strong>Obter Conteúdo do URL</strong>:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                URL: <code className="break-all">{endpoint}</code>
              </li>
              <li>Método: POST</li>
              <li>
                Cabeçalho: <code>Authorization</code> com o valor <code>Bearer</code>, um espaço e o seu código
              </li>
              <li>
                Corpo da solicitação: JSON, com os campos <code>date</code> (a data formatada), <code>steps</code>,{" "}
                <code>distance_km</code>, <code>active_kcal</code>, <code>weight_kg</code> e <code>weight_at</code> (os resultados acima)
              </li>
            </ul>
          </li>
          <li>
            Para testar, toque em ▶. A resposta deve dizer &ldquo;Survivor recebeu: ... passos&rdquo;, e esta tela passa a mostrar
            &ldquo;Conectado&rdquo;.
          </li>
        </ol>
      </Card>

      <Card index={3} title="Enviar sozinho">
        <p className="mb-3">
          Na aba <strong>Automação</strong> do app Atalhos, crie uma automação de <strong>Hora do Dia</strong> que roda o atalho
          Survivor, por exemplo às 12h, às 18h e às 22h. Escolha <strong>Executar Imediatamente</strong> para não precisar confirmar.
        </p>
        <p className="text-muted">
          Os nomes das opções podem mudar um pouco conforme a versão do iPhone. Enviar duas vezes no mesmo dia não duplica nada: o
          Survivor atualiza os números do dia.
        </p>
      </Card>

      <Card index={4} title="Para quem monta atalhos">
        <p className="mb-2 text-muted">
          Exemplo do corpo aceito. Todos os campos, menos a data, são opcionais. Datas com hora precisam do fuso (-03:00). O peso só é
          salvo com <code>weight_at</code>.
        </p>
        <pre className="overflow-x-auto rounded-2xl bg-surface-2 p-3 text-sm">{`{
  "date": "2026-11-26",
  "steps": 5234,
  "distance_km": 3.8,
  "active_kcal": 210,
  "weight_kg": 101.4,
  "weight_at": "2026-11-26T07:05:00-03:00",
  "sleep": { "bedtime": "2026-11-25T23:10:00-03:00",
             "wake": "2026-11-26T06:40:00-03:00" },
  "workouts": [{ "type": "Caminhada", "minutes": 35,
                 "start": "2026-11-26T07:00:00-03:00" }]
}`}</pre>
      </Card>

      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
