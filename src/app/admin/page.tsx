import { BottomNav, Card, Notice, Page } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { addDays, dayRange, formatDateTime, todayISO } from "@/lib/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { revokeInvite, setUserActive } from "./actions";
import { CopyLink, InviteForm } from "./invite-form";

// O painel usa a service role, mas lê só colunas não sensíveis: nome, papel,
// situação e datas. Peso, refeições, saúde e treinos ficam de fora.
export default async function AdminPage() {
  const me = await requireAdmin();
  const db = createSupabaseAdminClient();
  // Os links de convite usam APP_URL. Sem ela, o endereço viria do cabeçalho
  // Host da requisição, que pode ser falsificado.
  const origin = process.env.APP_URL?.replace(/\/$/, "") ?? null;
  const weekAgo = dayRange(addDays(todayISO(), -6)).from;
  const monthStart = `${todayISO().slice(0, 8)}01T00:00:00-03:00`;

  const [invitesRes, profilesRes, usersRes, aiRes] = await Promise.all([
    db.from("invites").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("profiles").select("id, display_name, role, active, created_at, onboarding_completed_at, last_seen_at").order("created_at"),
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("ai_usage").select("input_tokens, output_tokens, ok").gte("created_at", new Date(monthStart).toISOString()).limit(100000),
  ]);

  const emails = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u.email]));
  const profiles = profilesRes.data ?? [];
  const weekAgoMs = new Date(weekAgo).getTime();
  const activeUsers = profiles.filter((p) => p.last_seen_at && new Date(p.last_seen_at).getTime() >= weekAgoMs);
  const ai = aiRes.data ?? [];
  const tokens = ai.reduce((a, r) => ({ in: a.in + (r.input_tokens ?? 0), out: a.out + (r.output_tokens ?? 0) }), { in: 0, out: 0 });

  return (
    <Page title="Administração">
      <Card title="Resumo">
        <ul className="space-y-1">
          <li>Contas: <strong>{profiles.length}</strong> ({profiles.filter((p) => p.active).length} ativas)</li>
          <li>Usaram o app nos últimos 7 dias: <strong>{activeUsers.length}</strong></li>
          <li>Análises de IA neste mês: <strong>{ai.length}</strong> ({ai.filter((r) => !r.ok).length} com erro)</li>
          <li>Tokens neste mês: {tokens.in.toLocaleString("pt-BR")} de entrada, {tokens.out.toLocaleString("pt-BR")} de saída</li>
        </ul>
      </Card>

      <Card title="Novo convite">
        <InviteForm />
      </Card>

      <Card title="Convites">
        {!origin && (
          <Notice tone="error">
            Defina a variável APP_URL (endereço público do app) para gerar os links de convite.
          </Notice>
        )}
        <ul className="divide-y divide-border">
          {(invitesRes.data ?? []).map((inv) => {
            const url = `${origin}/cadastro?convite=${inv.code}`;
            const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
            const status = inv.revoked ? "cancelado" : expired ? "vencido" : inv.uses >= inv.max_uses ? "esgotado" : "ativo";
            return (
              <li key={inv.id} className="py-3">
                <p className="font-medium">{inv.label || "Sem nome"} <span className="text-muted">· {status}</span></p>
                <p className="text-sm text-muted">
                  {inv.uses} de {inv.max_uses} usos · vence {inv.expires_at ? formatDateTime(inv.expires_at) : "nunca"}
                </p>
                {status === "ativo" && (
                  <div className="mt-2 flex gap-2">
                    {origin && <CopyLink url={url} />}
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="rounded-lg border border-danger px-3 py-1 text-sm text-danger">Cancelar</button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Pessoas">
        <ul className="divide-y divide-border">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {p.display_name} {p.role === "admin" && <span className="text-muted">(admin)</span>}
                </p>
                <p className="text-sm text-muted">
                  {emails.get(p.id)} · {p.onboarding_completed_at ? "cadastro completo" : "anamnese pendente"}
                  {!p.active && " · desativada"}
                </p>
              </div>
              {p.id !== me.id && (
                <form action={setUserActive}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={String(!p.active)} />
                  <button type="submit" className="rounded-lg border border-border px-3 py-1 text-sm">
                    {p.active ? "Desativar" : "Reativar"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <BottomNav isAdmin />
    </Page>
  );
}
