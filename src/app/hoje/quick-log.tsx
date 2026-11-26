"use client";

import { useState } from "react";
import { BloodPressureForm, StepsForm, SymptomForm, WeightForm } from "./log-forms";

type Tab = "weight" | "steps" | "bp" | "symptom";

/** Registro rápido em abas: uma coisa de cada vez, sem uma tela cheia de formulários. */
export function QuickLog({ cautious, manualSteps }: { cautious: boolean; manualSteps: number | null }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "weight", label: "Peso" },
    { id: "steps", label: "Passos" },
    ...(cautious
      ? ([
          { id: "bp", label: "Pressão" },
          { id: "symptom", label: "Sintoma" },
        ] as const)
      : []),
  ];
  const [tab, setTab] = useState<Tab>("weight");

  return (
    <div>
      <div role="tablist" aria-label="O que registrar" className="mb-4 flex gap-1 rounded-2xl bg-surface-2 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-10 min-w-0 flex-1 rounded-lg px-1 text-[0.85rem] font-semibold transition ${
              tab === t.id ? "bg-surface text-foreground ring-1 ring-border" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" key={tab} className="rise">
        {tab === "weight" && <WeightForm />}
        {tab === "steps" && <StepsForm current={manualSteps} />}
        {tab === "bp" && <BloodPressureForm />}
        {tab === "symptom" && <SymptomForm />}
      </div>
    </div>
  );
}
