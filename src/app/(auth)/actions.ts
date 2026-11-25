"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Digite a senha."),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos." };
  redirect("/");
}

const signUpSchema = z.object({
  invite: z.string().trim().optional(),
  name: z.string().trim().min(2, "Digite seu nome.").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { invite, name, email, password } = parsed.data;

  const admin = createSupabaseAdminClient();

  // Primeiro administrador: o e-mail definido em BOOTSTRAP_ADMIN_EMAIL entra
  // sem convite enquanto ainda não existir nenhum administrador.
  let role: "member" | "admin" = "member";
  let inviteId: string | null = null;
  let invitedBy: string | null = null;

  const bootstrap = env.bootstrapAdminEmail();
  if (bootstrap && email === bootstrap) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) === 0) role = "admin";
  }

  if (role !== "admin") {
    if (!invite) return { error: "O cadastro precisa de um link de convite." };
    const { data, error } = await admin.rpc("claim_invite", { p_code: invite });
    if (error || !data) return { error: "Convite inválido, vencido ou já usado." };
    inviteId = data as string;
    const { data: inv } = await admin.from("invites").select("created_by").eq("id", inviteId).single();
    invitedBy = inv?.created_by ?? null;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });

  if (createError || !created.user) {
    if (inviteId) await admin.rpc("release_invite", { p_id: inviteId });
    const exists = createError?.message?.toLowerCase().includes("already");
    return { error: exists ? "Já existe uma conta com esse e-mail." : "Não foi possível criar a conta." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    display_name: name,
    role,
    invited_by: invitedBy,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    if (inviteId) await admin.rpc("release_invite", { p_id: inviteId });
    return { error: "Não foi possível criar a conta." };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/consentimento");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
