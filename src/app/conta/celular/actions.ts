"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TokenState = { token?: string; error?: string };

/** Gera um código novo (o antigo deixa de valer). O código só aparece agora; o banco guarda o hash. */
export async function createToken(): Promise<TokenState> {
  const profile = await requireOnboarded();
  const token = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("device_tokens")
    .upsert({ user_id: profile.id, token_hash: hash, created_at: new Date().toISOString(), last_used_at: null });
  if (error) return { error: "Não foi possível gerar o código. Tente de novo." };
  revalidatePath("/conta/celular");
  return { token };
}

export async function revokeToken(): Promise<void> {
  const profile = await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  await supabase.from("device_tokens").delete().eq("user_id", profile.id);
  revalidatePath("/conta/celular");
}
