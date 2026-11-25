"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, Field, Notice, Select, Textarea, Input } from "@/components/ui";
import { MEAL_TYPE_LABEL } from "@/lib/dates";
import { scale, total } from "@/lib/food/nutrients";
import { analyzeMealText, saveMeal, type AnalyzeState, type DraftItem } from "../actions";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function MealForm({ suggestedType }: { suggestedType: string }) {
  const [mealType, setMealType] = useState(suggestedType);
  const [text, setText] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [state, analyze, analyzing] = useActionState<AnalyzeState, FormData>(async (prev, formData) => {
    const result = await analyzeMealText(prev, formData);
    if (result.items) {
      const added = result.items;
      setItems((current) => [...current, ...added]);
      setText("");
    }
    return { error: result.error, remaining: result.remaining };
  }, {});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const update = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const computed = items.map((it) => scale(it.options[it.selected].per100g, it.grams || 0));
  const sum = total(computed);

  function onSave() {
    setSaveError(null);
    startSaving(async () => {
      const res = await saveMeal({
        meal_type: mealType as "breakfast",
        input_text: text,
        items: items.map((it) => ({
          name: it.name,
          preparation: it.preparation,
          grams: it.grams,
          food_id: it.options[it.selected].foodId,
          per100g: it.options[it.selected].per100g,
        })),
      });
      if (res?.error) setSaveError(res.error);
    });
  }

  return (
    <>
      <Card>
        <Field label="Refeição">
          <Select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            {Object.entries(MEAL_TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
        <form action={analyze}>
          <Field
            label={items.length ? "Esqueceu algo? Descreva e adicione" : "O que você comeu?"}
            hint="Exemplo: 4 colheres de arroz, 1 concha de feijão, 1 bife grelhado e salada de alface com tomate."
          >
            <Textarea name="text" value={text} onChange={(e) => setText(e.target.value)} required maxLength={1500} />
          </Field>
          <Button type="submit" disabled={analyzing} className="w-full" variant={items.length ? "secondary" : "primary"}>
            {analyzing ? "Analisando..." : items.length ? "Adicionar à lista" : "Analisar"}
          </Button>
        </form>
        {state.error && <div className="mt-3"><Notice tone="error">{state.error}</Notice></div>}
        {state.remaining !== undefined && state.remaining <= 3 && (
          <p className="mt-2 text-sm text-muted">Restam {state.remaining} análises por IA hoje.</p>
        )}
      </Card>

      {items.length > 0 && (
        <Card title="Confira antes de salvar">
          <ul className="divide-y divide-border">
            {items.map((it, idx) => {
              const n = computed[idx];
              const opt = it.options[it.selected];
              return (
                <li key={it.key} className="py-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{it.name}</p>
                      {it.confidence === "low" && (
                        <p className="text-sm text-warning-fg">A IA não tem certeza deste item. Confira a porção.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                      className="px-2 text-danger"
                      aria-label={`Remover ${it.name}`}
                    >
                      Remover
                    </button>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={it.grams}
                      min={1}
                      onChange={(e) => update(it.key, { grams: Number(e.target.value) })}
                      aria-label={`Gramas de ${it.name}`}
                      className="w-28"
                    />
                    <span>gramas</span>
                    <div className="ml-auto flex gap-1">
                      {[0.5, 1.5].map((f) => (
                        <button
                          key={f}
                          type="button"
                          className="rounded-lg border border-border px-3 py-2 text-sm"
                          onClick={() => update(it.key, { grams: Math.max(1, Math.round(it.grams * f)) })}
                        >
                          {f < 1 ? "Menos" : "Mais"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Select
                    value={it.selected}
                    onChange={(e) => update(it.key, { selected: Number(e.target.value) })}
                    aria-label={`Origem dos valores de ${it.name}`}
                    className="mb-2 text-sm"
                  >
                    {it.options.map((o, i) => (
                      <option key={i} value={i}>{o.label}</option>
                    ))}
                  </Select>
                  <p className="text-sm text-muted">
                    {fmt(n.kcal)} kcal · {n.protein_g} g proteína · {n.carbs_g} g carboidrato · {n.fat_g} g gordura · {n.fiber_g} g fibra
                    {opt.source === "estimated" && " · valor estimado"}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 rounded-xl bg-background p-3">
            <p className="text-lg font-bold">Total: {fmt(sum.kcal)} kcal</p>
            <p className="text-muted">
              {sum.protein_g} g proteína · {sum.carbs_g} g carboidrato · {sum.fat_g} g gordura · {sum.fiber_g} g fibra
            </p>
          </div>
          {saveError && <div className="mt-3"><Notice tone="error">{saveError}</Notice></div>}
          <Button type="button" onClick={onSave} disabled={saving || items.some((i) => !i.grams)} className="mt-3 w-full">
            {saving ? "Salvando..." : "Salvar refeição"}
          </Button>
        </Card>
      )}
    </>
  );
}
