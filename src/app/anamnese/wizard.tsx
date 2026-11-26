"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui";
import {
  ageOf,
  firstInvalid,
  healthNotes,
  healthyRange,
  medicationNotes,
  nextWhileEditing,
  paceEstimate,
  parseNum,
  SCREENING_WHY,
  sectionOf,
  stepsFor,
  toFormFields,
  validateStep,
  type Draft,
  type StepId,
} from "@/lib/health/anamnese-steps";
import { SCREENING_QUESTIONS, type ScreeningId } from "@/lib/health/screening";
import { saveAnamnese, type AnamneseState } from "./actions";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const GOAL_LABEL = { lose: "Perder peso", maintain: "Manter o peso", gain_muscle: "Ganhar massa muscular", gain_weight: "Ganhar peso" } as const;
const TRAINING_LABEL = { none: "Não treino", strength: "Musculação", calisthenics: "Calistenia", both: "Musculação e calistenia" } as const;
const LOCATION_LABEL = { gym: "Academia", home_equipment: "Em casa, com equipamento", home_none: "Em casa, sem equipamento" } as const;
const kg = (v: string) => `${String(parseNum(v) ?? "").replace(".", ",")} kg`;

export function AnamneseWizard({ initial, onboarded, name }: { initial: Draft; onboarded: boolean; name: string }) {
  const [d, setD] = useState<Draft>(initial);
  // Quem já preencheu começa pela revisão e muda só o que quiser.
  const [step, setStep] = useState<StepId>(onboarded ? "review" : "intro");
  const [editing, setEditing] = useState(onboarded);
  const [error, setError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<AnamneseState, FormData>(saveAnamnese, {});
  const heading = useRef<HTMLHeadingElement>(null);

  const router = useRouter();
  const dRef = useRef(d);
  useEffect(() => {
    dRef.current = d;
  }, [d]);

  const steps = stepsFor(d);
  const index = Math.max(0, steps.indexOf(step));
  const set = (patch: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  // O botão "voltar" do celular volta um passo em vez de sair da tela.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, anamnese: step }, "");
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { anamnese?: StepId } | null)?.anamnese;
      // Um passo que as respostas fecharam (ex.: detalhes do treino de quem agora não treina) é ignorado.
      if (s && (s === "review" || stepsFor(dRef.current).includes(s))) {
        setStep(s);
        setError(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // Só na montagem: depois disso cada passo entra no histórico em goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  const goTo = (s: StepId) => {
    window.history.pushState({ ...window.history.state, anamnese: s }, "");
    setStep(s);
    setError(null);
  };

  const next = () => {
    const err = validateStep(step, d);
    if (err) return setError(err);
    // Pela revisão: percorre o grupo do item (todas as perguntas de saúde, por exemplo) e volta.
    if (editing) return goTo(nextWhileEditing(step, d));
    const all = stepsFor(d);
    const i = all.indexOf(step);
    goTo(i === -1 ? (firstInvalid(d) ?? "review") : (all[i + 1] ?? "review"));
  };

  const back = () => window.history.back();

  const leave = () => {
    const changed = JSON.stringify(d) !== JSON.stringify(initial);
    if (changed && !window.confirm("Sair sem salvar as mudanças?")) return;
    router.push("/metas");
  };

  if (step === "review") {
    const fields = toFormFields(d);
    const invalid = firstInvalid(d);
    const invalidReason = invalid ? validateStep(invalid, d) : null;
    return (
      <Shell section="Conferir" progress={1} onBack={onboarded ? leave : back}>
        <Title ref={heading}>{onboarded ? "Seus dados" : "Confira antes de calcular"}</Title>
        <p className="mb-5 text-lg text-muted">Toque em “Mudar” para corrigir qualquer resposta.</p>
        <Review d={d} onEdit={(s) => { setEditing(true); goTo(s); }} />
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {invalid && invalidReason && (
          <Notice>
            Antes de salvar, falta acertar um item. {invalidReason}
          </Notice>
        )}
        <form action={action}>
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {invalid ? (
            <BigButton type="button" onClick={() => { setEditing(true); goTo(invalid); }}>
              Responder o que falta
            </BigButton>
          ) : (
            <BigButton type="submit" disabled={pending}>
              {pending ? "Calculando…" : onboarded ? "Salvar e recalcular metas" : "Calcular minhas metas"}
            </BigButton>
          )}
        </form>
      </Shell>
    );
  }

  const optional = step === "waist";
  return (
    <Shell
      section={sectionOf(step)}
      progress={index / (steps.length - 1)}
      onBack={step === "intro" ? undefined : back}
      onSkip={
        optional
          ? () => {
              // Pela revisão, "Pular" não apaga a medida salva: só volta.
              if (editing) {
                set({ waistCm: initial.waistCm });
                return goTo(firstInvalid({ ...d, waistCm: initial.waistCm }) ?? "review");
              }
              set({ waistCm: "" });
              goTo(steps[index + 1]);
            }
          : undefined
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        noValidate
      >
        <StepBody step={step} d={d} set={set} heading={heading} name={name} />
        {error && (
          <p role="alert" className="pop mb-4 rounded-2xl border border-danger px-4 py-3 text-lg text-danger">
            {error}
          </p>
        )}
        <BigButton type="submit">{continueLabel(step)}</BigButton>
        {step === "intro" && (
          <p className="mt-6 text-center">
            <Link href="/conta" className="text-muted underline underline-offset-4">
              Sair ou apagar minha conta
            </Link>
          </p>
        )}
      </form>
    </Shell>
  );
}

function continueLabel(step: StepId) {
  if (step === "intro") return "Começar";
  if (step === "pace" || step === "health_summary" || step === "meds_summary") return "Entendi";
  return "Continuar";
}

function StepBody({
  step,
  d,
  set,
  heading,
  name,
}: {
  step: StepId;
  d: Draft;
  set: (p: Partial<Draft>) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
  name: string;
}) {

  switch (step) {
    case "intro":
      return (
        <>
          <Title ref={heading}>Olá, {name}</Title>
          <Why>
            Vamos fazer algumas perguntas, uma de cada vez. Com elas o Survivor calcula suas metas do dia e liga os cuidados certos para
            a sua saúde.
          </Why>
          <ul className="mb-8 space-y-3 text-lg">
            <li>Leva uns 5 minutos.</li>
            <li>Se não souber um número exato, pode estimar. Depois dá para mudar.</li>
            <li>Tenha à mão a lista dos remédios que você toma.</li>
          </ul>
        </>
      );
    case "sex":
      return (
        <>
          <Title ref={heading}>Qual é o seu sexo?</Title>
          <Why>O corpo do homem e o da mulher gastam calorias de um jeito diferente. Usamos isso na conta.</Why>
          <Options
            value={d.sex}
            onChange={(v) => set({ sex: v })}
            options={[
              { value: "female", label: "Feminino" },
              { value: "male", label: "Masculino" },
            ]}
          />
        </>
      );
    case "birth": {
      const age = ageOf(d);
      return (
        <>
          <Title ref={heading}>Quando você nasceu?</Title>
          <Why>A idade muda o quanto o corpo gasta. A partir dos 60 anos o app também fica mais cuidadoso.</Why>
          <div className="mb-4 grid grid-cols-[1fr_2fr_1.4fr] gap-2">
            <BigSelect label="Dia" value={d.birthDay} onChange={(v) => set({ birthDay: v })}>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </BigSelect>
            <BigSelect label="Mês" value={d.birthMonth} onChange={(v) => set({ birthMonth: v })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </BigSelect>
            <label className="block">
              <span className="mb-1 block font-medium">Ano</span>
              <input
                inputMode="numeric"
                maxLength={4}
                placeholder="1960"
                value={d.birthYear}
                onChange={(e) => set({ birthYear: e.target.value.replace(/\D/g, "") })}
                className="min-h-14 w-full rounded-2xl border-2 border-border bg-surface px-3 text-xl outline-none focus:border-primary"
              />
            </label>
          </div>
          {age !== null && age >= 18 && age <= 100 && <p className="mb-6 text-lg text-muted">Você tem {age} anos.</p>}
        </>
      );
    }
    case "height":
      return (
        <>
          <Title ref={heading}>Qual é a sua altura?</Title>
          <Why>Com a altura calculamos quanto seu corpo gasta e qual é o peso saudável para você.</Why>
          <NumberInput value={d.heightCm} onChange={(v) => set({ heightCm: v })} unit="cm" placeholder="165" decimal />
        </>
      );
    case "weight":
      return (
        <>
          <Title ref={heading}>Quanto você pesa hoje?</Title>
          <Why>Pode ser aproximado. A cada vez que você se pesar no app, as contas se ajustam.</Why>
          <NumberInput value={d.weightKg} onChange={(v) => set({ weightKg: v })} unit="kg" placeholder="90" decimal />
        </>
      );
    case "goal":
      return (
        <>
          <Title ref={heading}>Qual é o seu objetivo?</Title>
          <Why>Daqui saem as calorias e a proteína de cada dia.</Why>
          <Options
            value={d.goal}
            onChange={(v) => set({ goal: v })}
            options={[
              { value: "lose", label: "Perder peso" },
              { value: "maintain", label: "Manter o peso" },
              { value: "gain_muscle", label: "Ganhar massa muscular", hint: "Com treino de força" },
              { value: "gain_weight", label: "Ganhar peso" },
            ]}
          />
        </>
      );
    case "target": {
      const height = parseNum(d.heightCm);
      const weight = parseNum(d.weightKg);
      const range = height ? healthyRange(height) : null;
      const tenPct = weight && d.goal === "lose" ? Math.round(weight * 0.9) : null;
      return (
        <>
          <Title ref={heading}>Aonde você quer chegar?</Title>
          <Why>
            {d.goal === "lose"
              ? "Perder de 5% a 10% do peso já melhora a pressão, o açúcar do sangue e as articulações. Dá para começar por aí e subir a meta depois."
              : "É o peso que você quer alcançar."}
          </Why>
          <NumberInput value={d.targetWeightKg} onChange={(v) => set({ targetWeightKg: v })} unit="kg" placeholder="80" decimal />
          {tenPct && range && tenPct >= range[0] && (
            <button
              type="button"
              onClick={() => set({ targetWeightKg: String(tenPct) })}
              className="mb-4 min-h-12 w-full rounded-2xl border-2 border-dashed border-primary px-4 text-lg font-semibold text-primary"
            >
              Usar 10% a menos: {tenPct} kg
            </button>
          )}
          {d.goal === "lose" && (
            <p className="mb-6 text-lg text-muted">Alcançou essa meta? Você define a próxima a qualquer momento.</p>
          )}
        </>
      );
    }
    case "pace": {
      const p = paceEstimate(d);
      const lose = d.goal === "lose";
      return (
        <>
          <Title ref={heading}>{lose ? "Sem pressa, e sem efeito sanfona" : "Aos poucos, do jeito certo"}</Title>
          {p && (
            <div className="mb-6 rounded-2xl bg-primary-soft p-5">
              <p className="text-lg">{lose ? "Faltam" : "São"}</p>
              <p className="text-4xl font-bold tracking-tight">{String(p.kg).replace(".", ",")} kg</p>
              <p className="mt-2 text-lg">
                No ritmo seguro, isso leva de <strong>{p.minMonths}</strong> a <strong>{p.maxMonths} meses</strong>.
              </p>
            </div>
          )}
          <Why>
            {lose
              ? "O app mira em perder de 0,5% a 1% do peso por semana. Mais rápido que isso, o corpo perde músculo e o peso tende a voltar."
              : "Ganhar devagar faz o peso novo ser mais músculo do que gordura."}
          </Why>
        </>
      );
    }
    case "daily":
      return (
        <>
          <Title ref={heading}>Como é o seu dia a dia?</Title>
          <Why>Sem contar caminhada e treino. Isso entra na conta do gasto do dia.</Why>
          <Options
            value={d.occupation}
            onChange={(v) => set({ occupation: v })}
            options={[
              { value: "sedentary", label: "Fico mais sentado", hint: "Escritório, casa, aposentado sem muita atividade" },
              { value: "active", label: "Ando bastante ou fico em pé", hint: "Comércio, serviços de casa, cuidar de alguém" },
            ]}
          />
        </>
      );
    case "walk":
      return (
        <>
          <Title ref={heading}>Quantos minutos você pretende caminhar por dia?</Title>
          <Why>Daqui sai a sua meta de passos. Comece com o que dá para fazer hoje: o app sobe aos poucos.</Why>
          <Chips
            value={d.walkMinutes}
            onChange={(v) => set({ walkMinutes: v })}
            options={["0", "10", "20", "30", "45", "60", "90"].map((v) => ({ value: v, label: v === "0" ? "Nenhum" : `${v} min` }))}
          />
        </>
      );
    case "training":
      return (
        <>
          <Title ref={heading}>Você faz algum treino de força?</Title>
          <Why>Treino de força ajuda a não perder músculo enquanto emagrece. Ele aumenta a meta de proteína.</Why>
          <Options
            value={d.training}
            onChange={(v) => set({ training: v })}
            options={[
              { value: "none", label: "Não treino" },
              { value: "strength", label: "Musculação", hint: "Com pesos ou aparelhos" },
              { value: "calisthenics", label: "Calistenia", hint: "Com o peso do corpo: flexão, agachamento" },
              { value: "both", label: "Os dois" },
            ]}
          />
        </>
      );
    case "training_detail": {
      const strength = d.training === "strength" || d.training === "both";
      const cal = d.training === "calisthenics" || d.training === "both";
      const times = ["1", "2", "3", "4", "5", "6", "7"].map((v) => ({ value: v, label: `${v}x` }));
      return (
        <>
          <Title ref={heading}>Como é o seu treino?</Title>
          <Why>Por semana, em média.</Why>
          {strength && (
            <>
              <Sub>Musculação: quantas vezes por semana?</Sub>
              <Chips label="Musculação: vezes por semana" value={d.strengthSessions} onChange={(v) => set({ strengthSessions: v })} options={times} />
              <Sub>Quanto tempo cada vez?</Sub>
              <Chips
                label="Musculação: minutos por vez"
                value={d.strengthMinutes}
                onChange={(v) => set({ strengthMinutes: v })}
                options={["30", "45", "60", "90"].map((v) => ({ value: v, label: `${v} min` }))}
              />
            </>
          )}
          {cal && (
            <>
              <Sub>Calistenia: quantas vezes por semana?</Sub>
              <Chips label="Calistenia: vezes por semana" value={d.calisthenicsSessions} onChange={(v) => set({ calisthenicsSessions: v })} options={times} />
              <Sub>Quanto tempo cada vez?</Sub>
              <Chips
                label="Calistenia: minutos por vez"
                value={d.calisthenicsMinutes}
                onChange={(v) => set({ calisthenicsMinutes: v })}
                options={["15", "20", "30", "45", "60"].map((v) => ({ value: v, label: `${v} min` }))}
              />
            </>
          )}
          <Sub>Onde você treina?</Sub>
          <Options
            label="Onde você treina"
            value={d.trainingLocation}
            onChange={(v) => set({ trainingLocation: v })}
            options={(Object.keys(LOCATION_LABEL) as (keyof typeof LOCATION_LABEL)[]).map((k) => ({ value: k, label: LOCATION_LABEL[k] }))}
          />
        </>
      );
    }
    case "experience":
      return (
        <>
          <Title ref={heading}>Você já treinou antes?</Title>
          <Why>Quem está voltando pode começar um pouco mais forte do que quem nunca treinou.</Why>
          <Options
            value={d.trainingExperience}
            onChange={(v) => set({ trainingExperience: v })}
            options={[
              { value: "never", label: "Nunca treinei" },
              { value: "stopped", label: "Já treinei e parei" },
            ]}
          />
        </>
      );
    case "waist":
      return (
        <>
          <Title ref={heading}>Quanto mede a sua cintura?</Title>
          <Why>
            Opcional. Meça com fita métrica na altura do umbigo, sem apertar. A cintura mostra a gordura da barriga, que é a que mais
            pesa para o coração.
          </Why>
          <NumberInput value={d.waistCm} onChange={(v) => set({ waistCm: v })} unit="cm" placeholder="100" decimal />
        </>
      );
    case "health_summary": {
      const { cautious, notes } = healthNotes(d, ageOf(d));
      return (
        <>
          <Title ref={heading}>{cautious ? "O app vai ter cuidado extra com você" : "Tudo certo por aqui"}</Title>
          {cautious ? (
            <>
              <Why>Pelas suas respostas, o Survivor liga o modo cuidadoso. Na prática:</Why>
              <ul className="mb-6 space-y-3">
                {notes.map((n) => (
                  <li key={n} className="rounded-2xl border border-border bg-surface p-4 text-lg">
                    {n}
                  </li>
                ))}
              </ul>
              <p className="mb-6 text-lg">Antes de aumentar o exercício, mostre suas metas ao seu médico.</p>
            </>
          ) : (
            <Why>Nenhuma resposta pede cuidado especial. Se algo mudar na sua saúde, atualize seus dados na tela Conta.</Why>
          )}
        </>
      );
    }
    case "meds":
      return (
        <>
          <Title ref={heading}>Quais remédios você toma?</Title>
          <Why>
            Um por linha, com a dose, como está na caixa. Exemplo: Losartana 50 mg. O app não muda nenhuma dose: só ajusta as metas e os
            avisos. Se não toma nenhum, deixe em branco.
          </Why>
          <textarea
            value={d.medications}
            onChange={(e) => set({ medications: e.target.value })}
            rows={6}
            placeholder={"Losartana 50 mg\nMetformina 850 mg"}
            className="mb-6 w-full rounded-2xl border-2 border-border bg-surface p-4 text-xl outline-none focus:border-primary"
          />
        </>
      );
    case "meds_summary": {
      const m = medicationNotes(d.medications);
      return (
        <>
          <Title ref={heading}>O que seus remédios mudam</Title>
          {m.recognized.length > 0 && (
            <>
              <Sub>Reconhecemos</Sub>
              <p className="mb-4 text-lg">{m.recognized.join(", ")}</p>
            </>
          )}
          {m.notes.length > 0 ? (
            <ul className="mb-4 space-y-3">
              {m.notes.map((n) => (
                <li key={n} className="rounded-2xl border border-border bg-surface p-4 text-lg">
                  {n}
                </li>
              ))}
            </ul>
          ) : (
            m.recognized.length > 0 && <p className="mb-4 text-lg">Nenhum deles muda as metas de comida.</p>
          )}
          {m.unknown.length > 0 && (
            <div className="mb-6 rounded-2xl bg-warning-bg p-4 text-lg text-warning-fg">
              <p className="mb-1 font-semibold">Não reconhecemos:</p>
              <p className="mb-2">{m.unknown.join(", ")}</p>
              <p>Confira o nome na caixa. Se estiver certo, tudo bem: o app fica mais cuidadoso com esses remédios.</p>
            </div>
          )}
        </>
      );
    }
    case "renal":
      return (
        <>
          <Title ref={heading}>Seu médico já liberou proteína alta?</Title>
          <Why>
            Proteína ajuda a manter os músculos enquanto você emagrece. A meta mais alta (2 g por quilo) só vale se o médico viu seus
            exames de rim e liberou.
          </Why>
          <Options
            value={d.renalClearance === null ? "" : d.renalClearance ? "yes" : "no"}
            onChange={(v) => set({ renalClearance: v === "yes" })}
            options={[
              { value: "yes", label: "Sim, ele liberou" },
              { value: "no", label: "Não, ou não sei" },
            ]}
          />
        </>
      );
    default: {
      // Perguntas de saúde, uma por tela.
      const id = step.slice("health_".length) as ScreeningId;
      const q = SCREENING_QUESTIONS.find((x) => x.id === id)!;
      const v = d.screening[id];
      return (
        <>
          <Title ref={heading}>{q.text}</Title>
          <Why>{SCREENING_WHY[id]}</Why>
          <Options
            value={v === undefined ? "" : v ? "yes" : "no"}
            onChange={(val) => set({ screening: { ...d.screening, [id]: val === "yes" } })}
            options={[
              { value: "yes", label: "Sim" },
              { value: "no", label: "Não" },
            ]}
            row
          />
        </>
      );
    }
  }
}

function Review({ d, onEdit }: { d: Draft; onEdit: (s: StepId) => void }) {
  const age = ageOf(d);
  const yes = SCREENING_QUESTIONS.filter((q) => d.screening[q.id]);
  const unanswered = SCREENING_QUESTIONS.find((q) => d.screening[q.id] === undefined);
  const meds = d.medications.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows: { label: string; value: string; step: StepId }[] = [
    { label: "Sexo", value: d.sex === "female" ? "Feminino" : d.sex === "male" ? "Masculino" : "—", step: "sex" },
    { label: "Idade", value: age !== null ? `${age} anos` : "—", step: "birth" },
    { label: "Altura", value: d.heightCm ? `${d.heightCm.replace(".", ",")} cm` : "—", step: "height" },
    { label: "Peso hoje", value: d.weightKg ? kg(d.weightKg) : "—", step: "weight" },
    { label: "Objetivo", value: d.goal ? GOAL_LABEL[d.goal] : "—", step: "goal" },
    { label: "Peso-alvo", value: d.targetWeightKg ? kg(d.targetWeightKg) : "—", step: "target" },
    {
      label: "Dia a dia",
      value: d.occupation === "active" ? "Ando bastante ou fico em pé" : d.occupation === "sedentary" ? "Fico mais sentado" : "—",
      step: "daily",
    },
    { label: "Caminhada", value: d.walkMinutes ? (d.walkMinutes === "0" ? "Nenhuma" : `${d.walkMinutes} min por dia`) : "—", step: "walk" },
    { label: "Treino", value: d.training ? TRAINING_LABEL[d.training] : "—", step: "training" },
    { label: "Cintura", value: d.waistCm ? `${d.waistCm.replace(".", ",")} cm` : "Não informada", step: "waist" },
    {
      label: "Saúde",
      value: unanswered ? "Faltam respostas" : yes.length ? `${yes.length} ${yes.length === 1 ? "resposta" : "respostas"} “sim”` : "Nenhum “sim”",
      // Começa pela primeira sem resposta; senão percorre todas as perguntas.
      step: `health_${(unanswered ?? SCREENING_QUESTIONS[0]).id}`,
    },
    { label: "Remédios", value: meds.length ? meds.join(", ") : "Nenhum", step: "meds" },
    {
      label: "Proteína alta liberada",
      value: d.renalClearance === null ? "—" : d.renalClearance ? "Sim" : "Não",
      step: "renal",
    },
  ];
  return (
    <ul className="mb-6 divide-y divide-border rounded-2xl border border-border bg-surface">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-muted">{r.label}</p>
            <p className="text-lg font-semibold break-words">{r.value}</p>
          </div>
          <button
            type="button"
            onClick={() => onEdit(r.step)}
            className="min-h-12 shrink-0 rounded-xl px-3 font-semibold text-primary underline underline-offset-4"
            aria-label={`Mudar ${r.label.toLowerCase()}`}
          >
            Mudar
          </button>
        </li>
      ))}
    </ul>
  );
}

function Shell({
  section,
  progress,
  onBack,
  backHref,
  onSkip,
  children,
}: {
  section: string;
  progress: number;
  onBack?: () => void;
  backHref?: string;
  onSkip?: () => void;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-4">
      <div className="mb-6 flex min-h-12 items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="-ml-2 min-h-12 rounded-xl px-2 text-lg font-semibold text-primary" aria-label="Voltar">
            ← Voltar
          </button>
        ) : backHref ? (
          <Link href={backHref} className="-ml-2 inline-flex min-h-12 items-center rounded-xl px-2 text-lg font-semibold text-primary">
            ← Voltar
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <div className="flex-1">
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{section}</p>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label="Progresso"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        </div>
        {onSkip && (
          <button type="button" onClick={onSkip} className="min-h-12 rounded-xl px-2 text-lg font-semibold text-muted underline underline-offset-4">
            Pular
          </button>
        )}
      </div>
      <div className="rise">{children}</div>
    </main>
  );
}

function Title({ children, ref }: { children: ReactNode; ref: React.Ref<HTMLHeadingElement> }) {
  return (
    <h1 ref={ref} id="step-title" tabIndex={-1} className="mb-3 text-[1.9rem] font-bold leading-tight tracking-tight outline-none">
      {children}
    </h1>
  );
}

function Why({ children }: { children: ReactNode }) {
  return <p className="mb-6 text-lg leading-relaxed text-muted">{children}</p>;
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-2 text-lg font-semibold">{children}</p>;
}

function Options<V extends string>({
  value,
  onChange,
  options,
  row,
  label,
}: {
  value: V | "";
  onChange: (v: V) => void;
  options: { value: V; label: string; hint?: string }[];
  row?: boolean;
  /** Nome do grupo para leitores de tela; sem ele, usa o título do passo. */
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-labelledby={label ? undefined : "step-title"} className={row ? "mb-6 grid grid-cols-2 gap-3" : "mb-6 flex flex-col gap-3"}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.98] ${
              on ? "border-primary bg-primary-soft" : "border-border bg-surface"
            } ${row ? "justify-center text-center" : ""}`}
          >
            <span className="flex-1">
              <span className="block text-xl font-semibold">{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-muted">{o.hint}</span>}
            </span>
            {!row && (
              <span
                aria-hidden
                className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {on && "✓"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Chips({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-labelledby={label ? undefined : "step-title"} className="mb-6 flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-14 min-w-20 rounded-2xl border-2 px-4 text-lg font-semibold transition active:scale-[0.97] ${
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  unit,
  placeholder,
  decimal,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder: string;
  decimal?: boolean;
}) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-5 focus-within:border-primary">
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, ""))}
        className="min-h-20 w-full bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:text-muted/40"
        aria-label={unit === "kg" ? "Peso em quilos" : "Medida em centímetros"}
      />
      <span className="text-2xl font-semibold text-muted">{unit}</span>
    </div>
  );
}

function BigSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-14 w-full rounded-2xl border-2 border-border bg-surface px-2 text-xl outline-none focus:border-primary"
      >
        <option value="" disabled>
          —
        </option>
        {children}
      </select>
    </label>
  );
}

function BigButton(props: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      className="min-h-16 w-full rounded-full bg-primary px-6 text-xl font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
    />
  );
}
