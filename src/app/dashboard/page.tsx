import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { DashboardApp } from "./DashboardApp";

export const metadata: Metadata = { title: "Dashboard | CampusTrack" };

export default async function DashboardPage() {
  // Verified on the server: the proxy only does a first pass.
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=no-profile");
  if (profile.status !== "active") redirect("/login?error=disabled");

  return <DashboardApp user={{ id: profile.id, email: profile.email, fullName: profile.fullName, role: profile.role }} />;
}
