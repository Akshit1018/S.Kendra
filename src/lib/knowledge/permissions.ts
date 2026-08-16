import type { AccessLevel, Department, UserRole } from "./types";

export function canAccess(opts: {
  role: UserRole;
  department: Department;
  accessLevel: AccessLevel;
  allowedRoles: UserRole[];
  docDepartment: Department;
}): boolean {
  const { role, department, accessLevel, allowedRoles, docDepartment } = opts;

  if (role === "knowledge_admin" || role === "security_admin") return true;

  switch (accessLevel) {
    case "public":
    case "internal":
      return true;
    case "department":
      return department === docDepartment;
    case "role_restricted":
      return allowedRoles.includes(role);
    case "confidential":
      return false;
    default:
      return false;
  }
}
