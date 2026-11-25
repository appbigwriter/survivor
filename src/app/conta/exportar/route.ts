import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TABLES = [
  "profiles",
  "consents",
  "health_screenings",
  "medications",
  "goals",
  "weight_logs",
  "step_logs",
  "bp_logs",
  "symptom_logs",
  "meals",
  "meal_items",
  "ai_usage",
] as const;

// Exportação LGPD: todos os registros do usuário, lidos com a sessão dele (RLS).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const result: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    email: user.email,
  };
  // Lê em páginas: o PostgREST limita cada resposta (1.000 linhas por padrão).
  const PAGE = 1000;
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
      if (error) {
        return NextResponse.json({ error: `Falha ao exportar ${table}. Tente de novo.` }, { status: 500 });
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    result[table] = rows;
  }

  return new NextResponse(JSON.stringify(result, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="survivor-meus-dados-${todayISO()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
