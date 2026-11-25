import { BottomNav, Page } from "@/components/ui";
import { requireOnboarded } from "@/lib/auth";
import { suggestMealType } from "@/lib/dates";
import { MealForm } from "./meal-form";

export default async function NewMealPage() {
  const profile = await requireOnboarded();
  return (
    <Page title="Registrar refeição" back="/hoje">
      <MealForm suggestedType={suggestMealType()} />
      <BottomNav isAdmin={profile.role === "admin"} />
    </Page>
  );
}
