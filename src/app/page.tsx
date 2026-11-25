import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";

export default async function Home() {
  await requireOnboarded();
  redirect("/hoje");
}
