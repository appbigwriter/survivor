"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SURVIVOR_CREATED } from "@/lib/accounts";
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
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "user_banned") {
    return { error: "Sua conta está desativada. Fale com quem enviou o convite." };
  }
  if (error || !data.user) return { error: "E-mail ou senha incorretos." };

  // Num Supabase compartilhado, o login pode existir sem cadastro no Survivor.
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Esse login ainda não tem cadastro no Survivor. Use o link de convite para criar a conta." };
  }
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

  const release = async () => {
    if (inviteId) await admin.rpc("release_invite", { p_id: inviteId });
  };
  const supabase = await createSupabaseServerClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
    app_metadata: SURVIVOR_CREATED,
  });

  let userId: string;
  let survivorCreated = false;
  if (created?.user) {
    userId = created.user.id;
    survivorCreated = true;
  } else if (createError?.code === "email_exists" || createError?.message?.toLowerCase().includes("already")) {
    // O e-mail já tem login neste Supabase (de outro app). Quem sabe a senha
    // dele pode ligar esse login ao Survivor.
    const { data: signed, error: signError } = await supabase.auth.signInWithPassword({ email, password });
    if (signError || !signed.user) {
      await release();
      return {
        error:
          "Esse e-mail já tem um login neste servidor, usado em outro app. Para entrar no Survivor, use a mesma senha desse login.",
      };
    }
    userId = signed.user.id;
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", userId);
    if ((count ?? 0) > 0) {
      await release();
      redirect("/");
    }
  } else {
    await release();
    return { error: "Não foi possível criar a conta." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    display_name: name,
    role,
    invited_by: invitedBy,
  });
  if (profileError) {
    if (survivorCreated) await admin.auth.admin.deleteUser(userId);
    else await supabase.auth.signOut();
    await release();
    return { error: "Não foi possível criar a conta." };
  }

  if (survivorCreated) await supabase.auth.signInWithPassword({ email, password });
  redirect("/consentimento");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
