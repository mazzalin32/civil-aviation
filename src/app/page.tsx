import { redirect } from "next/navigation";
import { homePathFor } from "@/components/app/nav-config";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(homePathFor(user.role));
}
