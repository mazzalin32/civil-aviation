import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

/** Lawyers used to land on /my-day; the prototype dashboard is shared. */
export default function Page() {
  redirect("/dashboard");
}
