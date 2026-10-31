import type { SupabaseClient } from "@supabase/supabase-js";

export const RESUME_BUCKET = "student-files";
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** resume_url holds either an external link (https://…) or a path in the private storage bucket. */
export const isStoredResume = (value: string | null | undefined): value is string => !!value && !/^https?:\/\//i.test(value);

export const resumePath = (studentId: string) => `${studentId}/resume.pdf`;

/** Opens a resume in a new tab, minting a short-lived signed URL for stored files. */
export async function openResume(supabase: SupabaseClient, value: string): Promise<void> {
  if (!isStoredResume(value)) {
    window.open(value, "_blank", "noopener");
    return;
  }
  // Open the tab synchronously (inside the click) so pop-up blockers allow it.
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(RESUME_BUCKET).createSignedUrl(value, 300);
  if (error || !data) {
    tab?.close();
    throw new Error(error?.message ?? "Could not open the resume.");
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
