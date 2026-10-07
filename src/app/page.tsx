import { redirect } from "next/navigation";
import { HOME } from "@/lib/roles";

export default function Home() {
  redirect(HOME);
}
