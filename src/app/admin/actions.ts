"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminState = { error?: string; ok?: string };

export async function createInvite(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      label: z.string().trim().max(60).optional(),
      max_uses: z.coerce.number().int().min(1, "Usos: de 1 a 500.").max(500, "Usos: de 1 a 500."),
      days: z.coerce.number().int().min(1, "Validade: de 1 a 365 dias.").max(365, "Validade: de 1 a 365 dias."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const code = randomBytes(9).toString("base64url");
  const expires = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000);
  const db = createSupabaseAdminClient();
  const { error } = await db.from("invites").insert({
    code,
    label: parsed.data.label || null,
    max_uses: parsed.data.max_uses,
    expires_at: expires.toISOString(),
    created_by: admin.id,
  });
  if (error) return { error: "Não foi possível criar o convite." };
  revalidatePath("/admin");
  return { ok: "Convite criado." };
}

export async function revokeInvite(formData: FormData) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  await db.from("invites").update({ revoked: true }).eq("id", String(formData.get("id")));
  revalidatePath("/admin");
}

export async function setUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === admin.id) return;
  const active = formData.get("active") === "true";
  const db = createSupabaseAdminClient();
  await db.from("profiles").update({ active }).eq("id", id);
  // Bloqueia o login e a renovação do token; a RLS já corta o acesso aos dados.
  await db.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/admin");
}
