import { BottomNav, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { MEAL_TYPE_LABEL, suggestMealType } from "@/lib/dates";
import { MealForm } from "./meal-form";

export default async function NewMealPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const profile = await requireOnboarded();
  // O "+" de cada refeição no painel já chega com o tipo escolhido (?tipo=lunch).
  const tipo = (await searchParams).tipo;
  const type = typeof tipo === "string" && Object.hasOwn(MEAL_TYPE_LABEL, tipo) ? tipo : suggestMealType();
  return (
    <Page title="Registrar refeição" back="/hoje">
      <MealForm suggestedType={type} />
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
