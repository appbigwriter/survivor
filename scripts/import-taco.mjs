// Importa a Tabela TACO para a tabela public.foods.
//
// Uso:
//   node --env-file=.env.local scripts/import-taco.mjs caminho/para/taco.csv
//
// O CSV precisa ter cabeçalho com estas colunas (separador vírgula ou ponto e vírgula):
//   codigo,nome,categoria,kcal,proteina,lipideos,carboidrato,fibra,sodio
// Valores por 100 g. "Tr", "NA", "*" e vazio viram 0. Vírgula decimal é aceita.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) {
  console.error("Informe o caminho do CSV da TACO.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

function splitLine(line, sep) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(v) {
  if (v === undefined) return 0;
  const s = String(v).trim();
  if (!s || /^(tr|na|\*|-)$/i.test(s)) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const text = readFileSync(file, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.trim());
const sep = lines[0].includes(";") ? ";" : ",";
const header = splitLine(lines[0], sep).map((h) => h.toLowerCase());
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Coluna ausente no CSV: ${name}`);
  return i;
};
const idx = {
  codigo: col("codigo"),
  nome: col("nome"),
  categoria: col("categoria"),
  kcal: col("kcal"),
  proteina: col("proteina"),
  lipideos: col("lipideos"),
  carboidrato: col("carboidrato"),
  fibra: col("fibra"),
  sodio: col("sodio"),
};

const rows = lines.slice(1).map((line) => {
  const c = splitLine(line, sep);
  return {
    source: "taco",
    source_code: c[idx.codigo],
    name: c[idx.nome],
    category: c[idx.categoria] || null,
    kcal_100g: num(c[idx.kcal]),
    protein_100g: num(c[idx.proteina]),
    fat_100g: num(c[idx.lipideos]),
    carbs_100g: num(c[idx.carboidrato]),
    fiber_100g: num(c[idx.fibra]),
    sodium_mg_100g: num(c[idx.sodio]),
  };
}).filter((r) => r.source_code && r.name);

const db = createClient(url, key, { auth: { persistSession: false } });
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200);
  const { error } = await db.from("foods").upsert(chunk, { onConflict: "source,source_code" });
  if (error) {
    console.error(`Erro no lote ${i / 200 + 1}:`, error.message);
    process.exit(1);
  }
}
console.log(`${rows.length} alimentos importados da TACO.`);
