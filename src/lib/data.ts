import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GoalRow = {
  id: string;
  starts_on: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  water_ml: number | null;
  sodium_mg: number | null;
  method: string;
  details: {
    bmr?: number;
    tdee?: number;
    exerciseKcal?: number;
    proteinPerKg?: number;
    proteinRefWeightKg?: number;
    floorApplied?: boolean;
    weeklyChangeRangePct?: [number, number];
    warnings?: string[];
    cautious?: boolean;
    ageYears?: number;
  };
  created_at: string;
};

export async function getCurrentGoal(): Promise<GoalRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("goals")
    .select("*")
    .order("starts_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as GoalRow | null) ?? null;
}

export async function isCautious(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("health_screenings").select("cautious_mode").maybeSingle();
  return data?.cautious_mode ?? true;
}
