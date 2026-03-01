export interface Project {
  id: string;
  name: string;
  role: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending';
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  managerId: string | null;
  avatar?: string;
  level: number;
  joinDate?: string;
  projects: Project[] | null;
  children?: Employee[];
  // Computed properties
  subordinatesCount?: number;
}

export interface OrgNode {
  employee: Employee;
  children: OrgNode[];
  x?: number;
  y?: number;
  depth?: number;
  isExpanded?: boolean;
}

export interface ExcelRow {
  [key: string]: string | number | undefined;
}

export interface ImportResult {
  success: boolean;
  employees: Employee[];
  errors: string[];
  total: number;
}
