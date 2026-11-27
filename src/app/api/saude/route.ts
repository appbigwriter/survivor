import { createHash } from "node:crypto";
import { CONSENT_VERSION } from "@/lib/consent";
import { addDays, todayISO } from "@/lib/dates";
import { dateAllowed, healthPayload, summary, workoutKind } from "@/lib/health-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Recebe os dados que o atalho do iPhone lê do Apple Saúde. Não há sessão de
// login: a pessoa é identificada pelo código pessoal (só o hash fica no banco).
// Por isso usa a chave de serviço e confere à mão: conta ativa e consentimento
// atual para dados de saúde, como o app exige no navegador.

const MAX_BODY = 20_000;

const json = (status: number, message: string) => Response.json({ ok: status < 300, message }, { status });

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (token.length < 20 || token.length > 200) return json(401, "Código pessoal ausente. Confira o atalho.");
  // Corpo grande é recusado antes de ser lido.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return json(413, "Dados grandes demais.");

  const db = createSupabaseAdminClient();
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: dev } = await db.from("device_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  if (!dev) return json(401, "Código pessoal inválido. Gere um novo na tela Conta do Survivor.");
  const uid = dev.user_id as string;

  const [{ data: profile }, { count: consents }] = await Promise.all([
    db.from("profiles").select("active").eq("id", uid).maybeSingle(),
    db.from("consents").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("version", CONSENT_VERSION),
  ]);
  if (!profile?.active) return json(403, "Conta desativada.");
  if ((consents ?? 0) < 2) return json(403, "Abra o Survivor e aceite os termos atualizados para voltar a receber os dados.");

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, "Dados grandes demais.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, "Os dados não estão no formato JSON. Confira o atalho.");
  }
  const parsed = healthPayload.safeParse(body);
  if (!parsed.success) return json(400, `Dados inválidos no campo ${parsed.error.issues[0].path.join(".") || "principal"}.`);
  const p = parsed.data;
  const today = todayISO();
  if (!dateAllowed(p.date, today, addDays)) return json(400, "A data precisa ser de hoje ou dos últimos 7 dias.");

  const now = new Date().toISOString();
  const errors: string[] = [];
  const skipped: string[] = [];
  const saved: { steps?: number; weight?: number; sleep?: boolean; workouts?: number } = {};

  if (p.steps !== undefined) {
    const { error } = await db.from("step_logs").upsert({
      user_id: uid,
      day: p.date,
      source: "apple_health",
      steps: p.steps,
      distance_m: p.distance_km !== undefined ? Math.round(p.distance_km * 1000) : null,
      active_kcal: p.active_kcal ?? null,
      updated_at: now,
    });
    if (error) errors.push("passos");
    else saved.steps = p.steps;
  }

  if (p.weight_kg !== undefined) {
    // Só com a data da pesagem: sem ela, a última pesagem (talvez de semanas atrás) viraria uma nova todo dia.
    if (!p.weight_at || !dateAllowed(todayISO(new Date(p.weight_at)), today, addDays)) {
      skipped.push(p.weight_at ? "peso antigo" : "peso sem data");
    } else {
      const at = new Date(p.weight_at).toISOString();
      const { error } = await db.from("weight_logs").upsert(
        { user_id: uid, source: "apple_health", external_id: `amostra:${at}`, weight_kg: p.weight_kg, measured_at: at },
        { onConflict: "user_id,source,external_id" },
      );
      if (error) errors.push("peso");
      else saved.weight = p.weight_kg;
    }
  }

  if (p.sleep) {
    const sleepH = (Date.parse(p.sleep.wake) - Date.parse(p.sleep.bedtime)) / 3_600_000;
    const wake = new Date(p.sleep.wake);
    const night = todayISO(wake);
    if (sleepH < 1 || sleepH > 16 || !dateAllowed(night, today, addDays)) {
      skipped.push("sono fora do intervalo");
    } else {
      const { error } = await db.from("sleep_logs").upsert(
        { user_id: uid, night, bedtime: new Date(p.sleep.bedtime).toISOString(), wake_time: wake.toISOString(), source: "apple_health", updated_at: now },
        { onConflict: "user_id,night,source" },
      );
      if (error) errors.push("sono");
      else saved.sleep = true;
    }
  }

  if (p.workouts?.length) {
    const rows = p.workouts
      .filter((w) => dateAllowed(todayISO(new Date(w.start)), today, addDays))
      .map((w) => ({
        user_id: uid,
        day: todayISO(new Date(w.start)),
        kind: workoutKind(w.type),
        minutes: Math.round(w.minutes),
        source: "apple_health",
        external_id: `${new Date(w.start).toISOString()}|${w.type}`,
        notes: w.type.slice(0, 100),
      }));
    if (rows.length < p.workouts.length) skipped.push("treinos antigos");
    if (rows.length) {
      // Reenvio atualiza a duração, se o treino foi corrigido no iPhone.
      const { error } = await db.from("activity_sessions").upsert(rows, { onConflict: "user_id,source,external_id" });
      if (error) errors.push("treinos");
      else saved.workouts = rows.length;
    }
  }

  await db.from("device_tokens").update({ last_used_at: now }).eq("user_id", uid);

  if (errors.length) return json(500, `Não foi possível salvar: ${errors.join(", ")}. Tente de novo mais tarde.`);
  return json(200, summary(saved, skipped));
}
