"use client";

import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardData, SessionUser } from "@/lib/types";

export type View = "Overview" | "Students" | "Alumni" | "Import data" | "Drives" | "Reports" | "Settings";
export type StudentFilter = "all" | "placed" | "unplaced" | "higher-studies" | "incomplete";

export type DashboardContextValue = {
  supabase: SupabaseClient;
  user: SessionUser;
  data: DashboardData;
  refresh: () => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
  openView: (view: View, options?: { studentFilter?: StudentFilter; createDrive?: boolean; driveId?: number }) => void;
  onUserUpdated: (user: SessionUser) => void;
  signOut: () => Promise<void>;
};

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside <DashboardContext>");
  return value;
}
