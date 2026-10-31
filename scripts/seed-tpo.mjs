// Creates (or repairs) the demo TPO Admin account from environment variables.
//   DEMO_TPO_EMAIL=... DEMO_TPO_PASSWORD=... npm run seed:tpo
// Reads .env.local via `node --env-file-if-exists`. No credentials live in code.
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, DEMO_TPO_EMAIL, DEMO_TPO_PASSWORD, DEMO_TPO_NAME } = process.env;
const missing = Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, DEMO_TPO_EMAIL, DEMO_TPO_PASSWORD }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}. Add them to .env.local.`);
  process.exit(1);
}
if (DEMO_TPO_PASSWORD.length < 12) {
  console.error("DEMO_TPO_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const email = DEMO_TPO_EMAIL.trim().toLowerCase();
const fullName = DEMO_TPO_NAME?.trim() || "TPO Admin";
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser() {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

try {
  let user = await findUser();
  if (user) {
    const { error } = await db.auth.admin.updateUserById(user.id, { password: DEMO_TPO_PASSWORD, email_confirm: true, app_metadata: { provisioned: true } });
    if (error) throw error;
    console.log(`Updated password for existing user ${email}.`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email, password: DEMO_TPO_PASSWORD, email_confirm: true,
      app_metadata: { provisioned: true },
      user_metadata: { role: "tpo_admin", full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created ${email}.`);
  }

  // Roles live in profiles and are only ever set server-side.
  const { error: profileError } = await db.from("profiles").upsert({ id: user.id, email, full_name: fullName, role: "tpo_admin", status: "active" }, { onConflict: "id" });
  if (profileError) throw profileError;
  // A TPO admin must not also have a student/alumni record.
  await db.from("students").delete().eq("id", user.id);
  await db.from("alumni").delete().eq("id", user.id);
  console.log(`${email} is a TPO Admin.`);
} catch (error) {
  console.error("Seeding the TPO Admin failed:", error.message ?? error);
  process.exit(1);
}
