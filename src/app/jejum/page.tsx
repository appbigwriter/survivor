import { BottomNav, Card, Notice, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { eatingWindow, formatHHMM, parseHHMM, protocolById } from "@/lib/fasting";
import { liveFasting, loadFastingContext } from "@/lib/fasting-server";
import { DisableFastingButton, FastingForm } from "./fasting-form";

export default async function FastingPage() {
  const profile = await requireOnboarded();
  const ctx = await loadFastingContext(profile);
  const { facts, settings, ready } = ctx;
  const live = liveFasting(ctx);
  const active = live.active;
  const p = settings ? protocolById(settings.protocol) : null;
  const w = settings ? eatingWindow(settings.protocol, parseHHMM(settings.eating_start.slice(0, 5)) ?? 480) : null;

  return (
    <Page title="Jejum intermitente" back="/hoje">
      {!ready && <Notice tone="info">O jejum ainda não está disponível neste servidor.</Notice>}
      {live.suspended && (
        <Notice>
          <p className="mb-1 font-semibold">Seu jejum está suspenso.</p>
          {ctx.incomplete ? (
            <p>Não foi possível conferir seus dados agora. Tente de novo em instantes.</p>
          ) : (
            <>
              <p className="mb-1">Seus dados mudaram desde que você ativou o jejum:</p>
              <ul className="list-disc space-y-1 pl-5">
                {live.eligibility?.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-1">Responda de novo abaixo para conferir.</p>
            </>
          )}
        </Notice>
      )}

      {active && p && w && (
        <Card index={0}>
          <p className="text-muted">Seu jejum</p>
          <p className="mb-1 text-2xl font-bold">{p.label}</p>
          <p className="mb-4">
            Come das {formatHHMM(w.start)} às {formatHHMM(w.end)}.
          </p>
          <DisableFastingButton />
        </Card>
      )}

      <Card index={1} title="Como funciona">
        <div className="space-y-3">
          <p>
            Você come dentro de uma janela de horário e fica sem comer no resto do dia. O app conta o jejum sozinho, a partir da
            hora das refeições que você registra.
          </p>
          <p>
            Nos estudos, o jejum emagrece mais ou menos o mesmo que comer um pouco menos ao longo do dia. A vantagem é que, para
            muita gente, um horário fixo é mais fácil de seguir do que contar cada caloria.
          </p>
          <p>
            Durante o jejum valem água, café e chá sem açúcar. Os remédios continuam no horário de sempre: se algum precisa ser
            tomado com comida, combine com seu médico.
          </p>
          <p>Se sentir tontura, fraqueza ou mal-estar, pare o jejum, coma algo e registre o sintoma no app.</p>
        </div>
      </Card>

      {ready && (
        <Card index={2} title={active ? "Mudar o jejum" : "Ver se é para você"}>
          <FastingForm facts={facts} settings={settings} />
        </Card>
      )}

      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
