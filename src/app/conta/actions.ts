"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type DeleteState = { error?: string };

export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const profile = await requireProfile();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "APAGAR") {
    return { error: "Digite APAGAR para confirmar." };
  }
  const admin = createSupabaseAdminClient();
  if (profile.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Você é o único administrador. Promova outra pessoa antes de apagar sua conta." };
    }
  }

  // Apagar o usuário apaga em cascata todos os registros ligados a ele.
  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) return { error: "Não foi possível apagar a conta. Tente de novo." };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
