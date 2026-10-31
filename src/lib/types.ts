export type AccountRole = "admin" | "student" | "alumni";
export type PlacementStatus = "placed" | "unplaced" | "higher-studies";
export type DriveStatus = "upcoming" | "ongoing" | "completed";
export type ApplicationStatus = "applied" | "shortlisted" | "interviewed" | "selected" | "rejected";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AccountRole;
};

type PersonRef = { full_name: string; email: string } | null;

export type Student = {
  id: string;
  roll_no: string;
  department: string;
  batch_year: number;
  division: string | null;
  contact: string | null;
  resume_url: string | null;
  skills: string[];
  cgpa: number | null;
  percentage: number | null;
  backlog_count: number;
  placement_status: PlacementStatus;
  placed_company: string | null;
  placed_package: number | null;
  updated_at: string;
  profiles: PersonRef;
};

export type Alumnus = {
  id: string;
  batch_year: number;
  department: string;
  current_company: string | null;
  designation: string | null;
  location: string | null;
  linkedin_url: string | null;
  contact: string | null;
  willing_to_refer: boolean;
  willing_to_mentor: boolean;
  profiles: PersonRef;
};

export type Company = {
  id: number;
  name: string;
  sector: string | null;
  website: string | null;
  hr_contact: string | null;
};

export type Eligibility = {
  min_cgpa?: number | null;
  max_backlogs?: number | null;
  departments?: string[];
};

export type Drive = {
  id: number;
  company_id: number;
  role: string;
  package_range: string | null;
  eligibility_criteria: Eligibility;
  drive_date: string;
  application_deadline: string | null;
  status: DriveStatus;
  companies: { name: string } | null;
};

export type Application = {
  id: number;
  student_id: string;
  drive_id: number;
  status: ApplicationStatus;
  applied_at: string;
};

export type PlacementEvent = {
  id: number;
  student_id: string;
  drive_id: number | null;
  kind: "placement" | "application";
  from_value: string | null;
  to_value: string | null;
  detail: string | null;
  actor_id: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
};

export type Notification = {
  id: number;
  title: string;
  message: string;
  created_at: string;
};

export type DashboardData = {
  students: Student[];
  alumni: Alumnus[];
  companies: Company[];
  drives: Drive[];
  applications: Application[];
  notifications: Notification[];
};
