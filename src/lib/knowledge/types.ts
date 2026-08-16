export const USER_ROLES = [
  "field_engineer",
  "support_agent",
  "knowledge_admin",
  "security_admin",
  "executive",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ACCESS_LEVELS = [
  "public",
  "internal",
  "role_restricted",
  "department",
  "confidential",
] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const DEPARTMENTS = [
  "logistics",
  "payments",
  "support",
  "security",
  "executive",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type SourceType = "sop" | "policy" | "runbook" | "playbook" | "sla";

export type DocumentRecord = {
  id: string;
  title: string;
  sourceType: SourceType;
  department: Department;
  allowedRoles: UserRole[];
  accessLevel: AccessLevel;
  language: "en" | "hi" | "en-hi";
  version: string;
  updatedAt: string;
  summary: string;
};

export type ChunkRecord = {
  id: string;
  documentId: string;
  content: string;
  page: number;
  section: string;
  headingPath: string[];
  chunkIndex: number;
  department: Department;
  allowedRoles: UserRole[];
  accessLevel: AccessLevel;
  language: "en" | "hi" | "en-hi";
  hasTable: boolean;
};

export type Citation = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  page: number | null;
  section: string;
  headingPath: string[];
  score: number;
  snippet: string;
};

export type QueryResult = {
  answer: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low" | "none";
  escalate: boolean;
  retrievedChunkIds: string[];
  latencyMs: number;
  modelUsed: string;
  permissionFiltered: boolean;
  auditId: string;
  warning: string | null;
};

export type Profile = {
  userId: string;
  role: UserRole;
  department: Department;
  displayName: string | null;
};

export const ROLE_META: Record<
  UserRole,
  { label: string; short: string; department: Department; blurb: string }
> = {
  field_engineer: {
    label: "Field Engineer",
    short: "Field",
    department: "logistics",
    blurb: "Hub, last-mile, and driver SOPs. No confidential security files.",
  },
  support_agent: {
    label: "Support Agent",
    short: "Support",
    department: "support",
    blurb: "Escalations, COD, and customer playbooks.",
  },
  knowledge_admin: {
    label: "Knowledge Admin",
    short: "Admin",
    department: "logistics",
    blurb: "Full library, uploads, and ACL control.",
  },
  security_admin: {
    label: "Security Admin",
    short: "Security",
    department: "security",
    blurb: "Incident response and data classification.",
  },
  executive: {
    label: "Executive",
    short: "Exec",
    department: "executive",
    blurb: "Internal policies and SLA summaries.",
  },
};
