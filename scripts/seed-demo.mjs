// Seeds realistic demo data into the Supabase project in .env.local.
//   node --env-file=.env.local scripts/seed-demo.mjs          # add demo data
//   node --env-file=.env.local scripts/seed-demo.mjs --reset  # remove it again
// Demo accounts are tagged with user_metadata.demo = true; all use password "demo1234".
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/seed-demo.mjs");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const PASSWORD = "demo1234";

const DEPTS = { CO: "Computer Engineering", IF: "Information Technology", EJ: "Electronics & Telecom", ME: "Mechanical Engineering", CE: "Civil Engineering", EE: "Electrical Engineering" };

// [name, dept, roll suffix, cgpa, backlogs, status, company, package]
const STUDENTS = [
  ["Aarav Shah", "CO", "104", 8.7, 0, "placed", "Tata Consultancy Services", 7.2],
  ["Priya More", "IF", "118", 8.4, 0, "unplaced"],
  ["Rohan Kulkarni", "ME", "203", 7.6, 1, "unplaced"],
  ["Sneha Nair", "EJ", "111", 9.1, 0, "placed", "Larsen & Toubro", 5.4],
  ["Vedant Kadam", "CE", "134", 7.9, 0, "unplaced"],
  ["Ishita Deshmukh", "CO", "121", 9.3, 0, "placed", "Persistent Systems", 9.5],
  ["Omkar Jadhav", "ME", "215", 6.8, 2, "unplaced"],
  ["Sakshi Pawar", "IF", "102", 8.9, 0, "placed", "Infosys", 6.5],
  ["Aditya Bhosale", "EE", "140", 7.4, 0, "higher-studies"],
  ["Neha Gaikwad", "CO", "133", 8.1, 0, "unplaced"],
  ["Tanmay Joshi", "EJ", "126", 7.2, 1, "unplaced"],
  ["Pooja Shinde", "CE", "109", 8.5, 0, "placed", "Larsen & Toubro", 5.4],
  ["Kunal Patil", "EE", "117", 8.0, 0, "placed", "Bharat Electronics", 6.8],
  ["Riya Chavan", "IF", "129", 7.7, 0, "unplaced"],
  ["Siddharth Mane", "ME", "222", 8.3, 0, "placed", "Tata Motors", 4.8],
  ["Anushka Salunkhe", "CO", "145", 6.9, 3, "unplaced"],
  ["Harsh Wagh", "EJ", "138", 8.8, 0, "unplaced"],
  ["Mrunal Thorat", "CE", "151", 7.1, 0, "higher-studies"],
];

const ALUMNI = [
  ["Rahul Patil", "Mechanical Engineering", 2019, "Tata Motors", "Production Engineer", "Pune", true, false],
  ["Snehal Kale", "Computer Engineering", 2020, "Persistent Systems", "Senior Software Engineer", "Pune", true, true],
  ["Amit Sawant", "Electronics & Telecom", 2018, "Bharat Electronics", "Deputy Engineer", "Bengaluru", false, true],
  ["Kavya Iyer", "Information Technology", 2021, "Infosys", "Systems Engineer", "Mumbai", true, false],
  ["Nikhil Gore", "Civil Engineering", 2017, "Larsen & Toubro", "Site Manager", "Nagpur", true, true],
];

const COMPANIES = [
  ["Tata Consultancy Services", "IT services"],
  ["Larsen & Toubro", "Engineering & construction"],
  ["Bharat Electronics", "Defence electronics"],
  ["Persistent Systems", "Software"],
  ["Infosys", "IT services"],
  ["Tata Motors", "Automotive"],
];

const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

// [company, role, date offset, status, package, eligibility]
const DRIVES = [
  ["Tata Consultancy Services", "Graduate Engineer Trainee", 4, "upcoming", "₹7.2 LPA", { min_cgpa: 7, max_backlogs: 0, departments: [] }],
  ["Larsen & Toubro", "Diploma Engineer Trainee", 9, "upcoming", "₹5.4 LPA", { min_cgpa: 6.5, max_backlogs: 1, departments: ["Civil Engineering", "Mechanical Engineering", "Electrical Engineering"] }],
  ["Bharat Electronics", "Junior Technical Officer", 1, "ongoing", "₹6.8 LPA", { min_cgpa: 7.5, max_backlogs: 0, departments: ["Electronics & Telecom", "Electrical Engineering"] }],
  ["Persistent Systems", "Associate Software Engineer", 21, "upcoming", "₹9.5 LPA", { min_cgpa: 8, max_backlogs: 0, departments: ["Computer Engineering", "Information Technology"] }],
  ["Infosys", "Systems Engineer", -30, "completed", "₹6.5 LPA", { min_cgpa: 6, max_backlogs: 0, departments: [] }],
  ["Tata Motors", "Apprentice Engineer", -45, "completed", "₹4.8 LPA", { min_cgpa: 6, max_backlogs: 2, departments: ["Mechanical Engineering"] }],
];

async function demoUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users.filter((u) => u.user_metadata?.demo));
    if (data.users.length < 1000) return users;
  }
}

async function reset() {
  const names = COMPANIES.map(([name]) => name);
  const { data: companies } = await db.from("companies").select("id").in("name", names);
  const ids = (companies ?? []).map((c) => c.id);
  if (ids.length) {
    await db.from("drives").delete().in("company_id", ids);
    await db.from("companies").delete().in("id", ids);
  }
  await db.from("notifications").delete().like("title", "%[demo]%");
  const users = await demoUsers();
  for (const u of users) await db.auth.admin.deleteUser(u.id);
  console.log(`Removed ${users.length} demo accounts, ${ids.length} companies and their drives.`);
}

async function createUser(email, metadata) {
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, app_metadata: { provisioned: true }, user_metadata: { ...metadata, demo: true } });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.user.id;
}

async function seed() {
  if ((await demoUsers()).length) {
    console.log("Demo data already exists. Run with --reset first to recreate it.");
    return;
  }

  const companyIds = {};
  for (const [name, sector] of COMPANIES) {
    const { data: existing } = await db.from("companies").select("id").eq("name", name).maybeSingle();
    if (existing) { companyIds[name] = existing.id; continue; }
    const { data, error } = await db.from("companies").insert({ name, sector }).select("id").single();
    if (error) throw error;
    companyIds[name] = data.id;
  }

  const studentIds = [];
  for (const [index, [name, code, suffix, cgpa, backlogs, status, company, pkg]] of STUDENTS.entries()) {
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@institute.edu`;
    const id = await createUser(email, { role: "student", full_name: name, roll_no: `${code}-22${suffix}`, department: DEPTS[code], batch_year: 2025 });
    const { error } = await db.from("students").update({
      cgpa, backlog_count: backlogs, placement_status: status,
      placed_company: company ?? null, placed_package: pkg ?? null,
      division: index % 2 ? "B" : "A",
      // Leave a few profiles incomplete so "Needs attention" has something to show.
      contact: index % 5 === 4 ? null : `98${String(76543210 + index * 1371).slice(0, 8)}`,
      resume_url: index % 4 === 3 ? null : `https://drive.google.com/demo-resume-${index}`,
      skills: code === "CO" || code === "IF" ? ["Java", "SQL", "React"] : code === "ME" || code === "CE" ? ["AutoCAD", "SolidWorks"] : ["Embedded C", "PCB design"],
      updated_at: new Date(Date.now() - index * 3_600_000).toISOString(),
    }).eq("id", id);
    if (error) throw error;
    studentIds.push({ id, dept: DEPTS[code], cgpa, backlogs, status, company });
    process.stdout.write(".");
  }

  for (const [name, department, batch, company, designation, location, refer, mentor] of ALUMNI) {
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@alumni.institute.edu`;
    const id = await createUser(email, { role: "alumni", full_name: name, department, batch_year: batch, current_company: company, designation });
    const { error } = await db.from("alumni").update({ location, willing_to_refer: refer, willing_to_mentor: mentor, linkedin_url: `https://linkedin.com/in/${name.toLowerCase().replace(/\s+/g, "")}` }).eq("id", id);
    if (error) throw error;
    process.stdout.write(".");
  }

  for (const [company, role, offset, status, packageRange, eligibility] of DRIVES) {
    const { data: drive, error } = await db.from("drives").insert({ company_id: companyIds[company], role, drive_date: day(offset), application_deadline: day(offset - 2), status, package_range: packageRange, eligibility_criteria: eligibility }).select("id").single();
    if (error) throw error;
    const eligible = studentIds.filter((s) => s.status !== "higher-studies" && (!eligibility.departments.length || eligibility.departments.includes(s.dept)) && s.cgpa >= eligibility.min_cgpa && s.backlogs <= eligibility.max_backlogs);
    const rows = eligible.map((s, i) => ({
      student_id: s.id, drive_id: drive.id,
      status: s.company === company ? "selected" : status === "completed" ? "rejected" : status === "ongoing" ? (i % 2 ? "shortlisted" : "interviewed") : i % 3 === 0 ? "shortlisted" : "applied",
    }));
    if (rows.length) {
      const { error: appError } = await db.from("applications").insert(rows);
      if (appError) throw appError;
    }
  }

  await db.from("notifications").insert([
    { title: "TCS drive registrations open [demo]", message: "All eligible final-year students must register by Friday. Carry two printed copies of your resume." },
    { title: "Aptitude practice session [demo]", message: "Mock aptitude test on Saturday, 10 AM in the seminar hall." },
  ]);

  console.log(`\nSeeded ${STUDENTS.length} students, ${ALUMNI.length} alumni, ${COMPANIES.length} companies and ${DRIVES.length} drives.`);
  console.log(`Demo student login: aarav.shah@institute.edu / ${PASSWORD}`);
}

(process.argv.includes("--reset") ? reset() : seed()).catch((error) => {
  console.error("\nSeeding failed:", error.message ?? error);
  process.exit(1);
});
