"use server";

import { serviceClient } from "@/lib/supabase-admin";
import type { AuthFormState } from "@/app/login/actions";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: FormDataEntryValue | null, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Public: an alumnus asks for an account. A TPO Admin approves it in Settings → Users & access. */
export async function requestAlumniAccess(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  // Honeypot: real users never see or fill this field.
  if (text(formData.get("website"))) return { info: "Request received." };

  const fullName = text(formData.get("full_name"), 120);
  const email = text(formData.get("email")).toLowerCase();
  const departmentId = Number(text(formData.get("department_id")));
  const passingYear = Number(text(formData.get("passing_year")));
  const currentYear = new Date().getFullYear();

  if (fullName.length < 2) return { error: "Enter your full name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid personal email address." };
  if (!Number.isInteger(departmentId) || departmentId <= 0) return { error: "Choose your department." };
  if (!Number.isInteger(passingYear) || passingYear < 1950 || passingYear > currentYear) return { error: `Passing year must be between 1950 and ${currentYear}.` };

  const admin = serviceClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return { error: "An account with this email already exists. Sign in, or use “Forgot password?”." };

  const { error } = await admin.from("alumni_requests").insert({
    full_name: fullName,
    personal_email: email,
    department_id: departmentId,
    passing_year: passingYear,
    roll_no: text(formData.get("roll_no"), 40) || null,
    current_company: text(formData.get("current_company"), 120) || null,
    message: text(formData.get("message"), 1000) || null,
  });
  if (error?.code === "23505") return { info: "We already have a pending request for this email. The TPO will email you once it's reviewed." };
  if (error) {
    console.error("alumni request insert failed:", error.message);
    return { error: "Could not send your request. Try again later." };
  }
  return { info: "Request sent. Your Training & Placement Office will review it and email you an invite link." };
}
