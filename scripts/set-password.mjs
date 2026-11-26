// Define uma senha nova para um login do Supabase, sem depender do e-mail de recuperação.
//
// Uso (no terminal, na pasta do projeto):
//   node --env-file=.env.local scripts/set-password.mjs
//
// O script pergunta o e-mail e a senha nova. A senha não aparece na tela e não é salva.
// Atenção: num Supabase compartilhado, a senha muda em todos os apps que usam esse login.

import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (rode com --env-file=.env.local).");
  process.exit(1);
}

// Um único leitor para todas as perguntas; enquanto "muted", o que se digita vira asteriscos.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let muted = false;
let currentQuestion = "";
rl._writeToOutput = (s) => {
  if (!muted || s.includes(currentQuestion)) rl.output.write(s);
  else if (s === "\r\n" || s === "\n" || s === "\r") rl.output.write(s);
  else rl.output.write("*".repeat(s.length));
};
const lines = rl[Symbol.asyncIterator]();

async function ask(question, { hidden = false } = {}) {
  currentQuestion = question;
  muted = false;
  rl.output.write(question);
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  if (hidden && process.stdin.isTTY) rl.output.write("\n");
  if (done) {
    console.error("\nEntrada encerrada. Nada foi alterado.");
    return fail();
  }
  return value.trim();
}

const db = createClient(url, key, { auth: { persistSession: false } });

class Abort extends Error {}
function fail(message) {
  if (message) console.error(message);
  throw new Abort();
}

async function main() {
  const email = (await ask("E-mail do login: ")).toLowerCase();
  let user = null;
  for (let page = 1; !user; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("Não foi possível listar os logins:", error.message);
      return fail();
    }
    user = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
    if (data.users.length < 1000) break;
  }
  if (!user) {
    console.error("Não existe login com esse e-mail neste Supabase.");
    return fail();
  }

  const password = await ask("Senha nova (mínimo 8 caracteres): ", { hidden: true });
  if (password.length < 8) {
    console.error("A senha precisa de pelo menos 8 caracteres.");
    return fail();
  }
  const again = await ask("Repita a senha nova: ", { hidden: true });
  if (again !== password) {
    console.error("As senhas não são iguais. Nada foi alterado.");
    return fail();
  }

  rl.close();

  const { error } = await db.auth.admin.updateUserById(user.id, { password });
  if (error) {
    console.error("Não foi possível trocar a senha:", error.message);
    return fail();
  }
  console.log("Senha trocada. Agora use essa senha no cadastro do Survivor.");
}

try {
  await main();
} catch (error) {
  if (!(error instanceof Abort)) console.error(error);
  process.exitCode = 1;
} finally {
  rl.close();
}
