import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ─── API shape DTOs (ISO dates: yyyy-MM-dd) ──────────────────────────────────

export interface EmployeeApiDTO {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  managerId: string | null;
  avatar?: string;
  level: number;
  joinDate?: string;            // ISO yyyy-MM-dd
  projects?: ProjectApiDTO[];
  subordinatesCount?: number;
}

export interface ProjectApiDTO {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  startDate?: string;           // ISO yyyy-MM-dd
  endDate?: string;             // ISO yyyy-MM-dd (null = đang tiếp tục)
  status: 'active' | 'completed' | 'pending';
}

export interface OrgNodeApiDTO {
  employee: EmployeeApiDTO;
  children: OrgNodeApiDTO[];
}

export interface ProjectInfoApiDTO {
  id?: number;
  projectName: string;
  customer?: string;
  contractNumber?: string;
  description?: string;
  startDate?: string;           // ISO yyyy-MM-dd
  endDate?: string;             // ISO yyyy-MM-dd
  contractValue?: number;       // VNĐ
  plannedCost?: number;         // VNĐ
  actualCost?: number;          // VNĐ
  // Calculated (read-only, server-side)
  totalInvoiced?: number;
  totalPaid?: number;
  profitMargin?: number;        // %
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceMilestoneApiDTO {
  id?: number;
  projectName: string;
  name: string;
  amount?: number;              // VNĐ
  plannedDate?: string;         // ISO yyyy-MM-dd
  actualDate?: string;          // ISO yyyy-MM-dd
  status: 'pending' | 'invoiced' | 'paid';
  note?: string;
  sortOrder: number;
  overdue?: boolean;            // read-only, server-side
}

export interface ProjectPhaseApiDTO {
  id?: number;
  projectName: string;
  name: string;
  plannedStart?: string;        // ISO yyyy-MM-dd
  plannedEnd?: string;          // ISO yyyy-MM-dd
  actualStart?: string;         // ISO yyyy-MM-dd
  actualEnd?: string;           // ISO yyyy-MM-dd
  progress: number;             // 0–100
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed';
  note?: string;
  sortOrder: number;
}

export interface DepartmentApiDTO {
  id: number;
  name: string;
  sortOrder: number;
}

export interface AuditLogApiDTO {
  id: number;
  action: string;         // CREATE | UPDATE | DELETE | IMPORT
  entityType: string;     // EMPLOYEE | PROJECT | DEPARTMENT
  entityId: string | null;
  entityName: string | null;
  actor: string;
  createdAt: string;      // ISO datetime
  detail: string | null;
}

export interface AuditLogPage {
  data: AuditLogApiDTO[];
  total: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  total?: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EFlowApiService {

  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ─── Employees ───────────────────────────────────────────────────────────

  /** GET /api/employees */
  getAllEmployees(): Observable<EmployeeApiDTO[]> {
    return this.http
      .get<ApiResponse<EmployeeApiDTO[]>>(`${this.base}/employees`)
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/employees/{id} (kèm projects) */
  getEmployee(id: string): Observable<EmployeeApiDTO> {
    return this.http
      .get<ApiResponse<EmployeeApiDTO>>(`${this.base}/employees/${id}`)
      .pipe(map(r => r.data));
  }

  /** GET /api/employees/org-tree */
  getOrgTree(): Observable<OrgNodeApiDTO[]> {
    return this.http
      .get<ApiResponse<OrgNodeApiDTO[]>>(`${this.base}/employees/org-tree`)
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/employees/search?keyword= */
  searchEmployees(keyword: string): Observable<EmployeeApiDTO[]> {
    const params = new HttpParams().set('keyword', keyword);
    return this.http
      .get<ApiResponse<EmployeeApiDTO[]>>(`${this.base}/employees/search`, { params })
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/employees/department/{dept} */
  getByDepartment(dept: string): Observable<EmployeeApiDTO[]> {
    return this.http
      .get<ApiResponse<EmployeeApiDTO[]>>(`${this.base}/employees/department/${dept}`)
      .pipe(map(r => r.data ?? []));
  }

  /** POST /api/employees */
  createEmployee(emp: EmployeeApiDTO): Observable<EmployeeApiDTO> {
    return this.http
      .post<ApiResponse<EmployeeApiDTO>>(`${this.base}/employees`, emp)
      .pipe(map(r => r.data));
  }

  /** PUT /api/employees/{id} */
  updateEmployee(id: string, emp: EmployeeApiDTO): Observable<EmployeeApiDTO> {
    return this.http
      .put<ApiResponse<EmployeeApiDTO>>(`${this.base}/employees/${id}`, emp)
      .pipe(map(r => r.data));
  }

  /** DELETE /api/employees/{id} */
  deleteEmployee(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/employees/${id}`)
      .pipe(map(() => void 0));
  }

  /**
   * POST /api/employees/bulk
   * Xoá toàn bộ dữ liệu cũ rồi import lại tất cả nhân viên + dự án.
   */
  bulkImport(employees: EmployeeApiDTO[]): Observable<void> {
    return this.http
      .post<ApiResponse<void>>(`${this.base}/employees/bulk`, employees)
      .pipe(map(() => void 0));
  }

  // ─── Projects ────────────────────────────────────────────────────────────

  /** GET /api/projects */
  getAllProjects(): Observable<ProjectApiDTO[]> {
    return this.http
      .get<ApiResponse<ProjectApiDTO[]>>(`${this.base}/projects`)
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/projects/employee/{employeeId} */
  getProjectsByEmployee(employeeId: string): Observable<ProjectApiDTO[]> {
    return this.http
      .get<ApiResponse<ProjectApiDTO[]>>(`${this.base}/projects/employee/${employeeId}`)
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/projects/status/{status} */
  getProjectsByStatus(status: string): Observable<ProjectApiDTO[]> {
    return this.http
      .get<ApiResponse<ProjectApiDTO[]>>(`${this.base}/projects/status/${status}`)
      .pipe(map(r => r.data ?? []));
  }

  /** POST /api/projects */
  createProject(proj: ProjectApiDTO): Observable<ProjectApiDTO> {
    return this.http
      .post<ApiResponse<ProjectApiDTO>>(`${this.base}/projects`, proj)
      .pipe(map(r => r.data));
  }

  /** PUT /api/projects/{id} */
  updateProject(id: string, proj: ProjectApiDTO): Observable<ProjectApiDTO> {
    return this.http
      .put<ApiResponse<ProjectApiDTO>>(`${this.base}/projects/${id}`, proj)
      .pipe(map(r => r.data));
  }

  /** DELETE /api/projects/{id} - xoá assignment (thành viên khỏi dự án) */
  deleteProject(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/projects/${id}`)
      .pipe(map(() => void 0));
  }

  // ─── Projects by name ────────────────────────────────────────────────────

  /** GET /api/projects/by-name/{name} - tất cả assignment của dự án */
  getProjectsByName(name: string): Observable<ProjectApiDTO[]> {
    return this.http
      .get<ApiResponse<ProjectApiDTO[]>>(`${this.base}/projects/by-name/${encodeURIComponent(name)}`)
      .pipe(map(r => r.data ?? []));
  }

  /** DELETE /api/projects/by-name/{name} - xoá toàn bộ dự án + tất cả thành viên */
  deleteProjectByName(name: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/projects/by-name/${encodeURIComponent(name)}`)
      .pipe(map(() => void 0));
  }

  /** PUT /api/projects/by-name/{name}/rename?newName= - đổi tên dự án */
  renameProject(oldName: string, newName: string): Observable<void> {
    const params = new HttpParams().set('newName', newName);
    return this.http
      .put<ApiResponse<void>>(
        `${this.base}/projects/by-name/${encodeURIComponent(oldName)}/rename`,
        null,
        { params }
      )
      .pipe(map(() => void 0));
  }

  /** PATCH /api/projects/by-name/{name}/status?status= - cập nhật trạng thái dự án độc lập */
  updateProjectStatus(projectName: string, status: string): Observable<void> {
    const params = new HttpParams().set('status', status);
    return this.http
      .patch<ApiResponse<void>>(
        `${this.base}/projects/by-name/${encodeURIComponent(projectName)}/status`,
        null,
        { params }
      )
      .pipe(map(() => void 0));
  }

  // ─── Project Finance Info ─────────────────────────────────────────────────

  /** GET /api/project-info */
  getAllProjectInfos(): Observable<ProjectInfoApiDTO[]> {
    return this.http
      .get<ApiResponse<ProjectInfoApiDTO[]>>(`${this.base}/project-info`)
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/project-info/{projectName} */
  getProjectInfo(projectName: string): Observable<ProjectInfoApiDTO> {
    return this.http
      .get<ApiResponse<ProjectInfoApiDTO>>(`${this.base}/project-info/${encodeURIComponent(projectName)}`)
      .pipe(map(r => r.data));
  }

  /** POST /api/project-info */
  createProjectInfo(dto: ProjectInfoApiDTO): Observable<ProjectInfoApiDTO> {
    return this.http
      .post<ApiResponse<ProjectInfoApiDTO>>(`${this.base}/project-info`, dto)
      .pipe(map(r => r.data));
  }

  /** PUT /api/project-info/{projectName} */
  updateProjectInfo(projectName: string, dto: ProjectInfoApiDTO): Observable<ProjectInfoApiDTO> {
    return this.http
      .put<ApiResponse<ProjectInfoApiDTO>>(`${this.base}/project-info/${encodeURIComponent(projectName)}`, dto)
      .pipe(map(r => r.data));
  }

  /** DELETE /api/project-info/{projectName} */
  deleteProjectInfo(projectName: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/project-info/${encodeURIComponent(projectName)}`)
      .pipe(map(() => void 0));
  }

  // ─── Invoice Milestones ───────────────────────────────────────────────────

  /** GET /api/invoice-milestones/{projectName} */
  getMilestones(projectName: string): Observable<InvoiceMilestoneApiDTO[]> {
    return this.http
      .get<ApiResponse<InvoiceMilestoneApiDTO[]>>(`${this.base}/invoice-milestones/${encodeURIComponent(projectName)}`)
      .pipe(map(r => r.data ?? []));
  }

  /** POST /api/invoice-milestones */
  createMilestone(dto: InvoiceMilestoneApiDTO): Observable<InvoiceMilestoneApiDTO> {
    return this.http
      .post<ApiResponse<InvoiceMilestoneApiDTO>>(`${this.base}/invoice-milestones`, dto)
      .pipe(map(r => r.data));
  }

  /** PUT /api/invoice-milestones/{id} */
  updateMilestone(id: number, dto: InvoiceMilestoneApiDTO): Observable<InvoiceMilestoneApiDTO> {
    return this.http
      .put<ApiResponse<InvoiceMilestoneApiDTO>>(`${this.base}/invoice-milestones/${id}`, dto)
      .pipe(map(r => r.data));
  }

  /** DELETE /api/invoice-milestones/{id} */
  deleteMilestone(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/invoice-milestones/${id}`)
      .pipe(map(() => void 0));
  }

  // ─── Project Phases ───────────────────────────────────────────────────────

  /** GET /api/project-phases/{projectName} */
  getPhases(projectName: string): Observable<ProjectPhaseApiDTO[]> {
    return this.http
      .get<ApiResponse<ProjectPhaseApiDTO[]>>(`${this.base}/project-phases/${encodeURIComponent(projectName)}`)
      .pipe(map(r => r.data ?? []));
  }

  /** POST /api/project-phases */
  createPhase(dto: ProjectPhaseApiDTO): Observable<ProjectPhaseApiDTO> {
    return this.http
      .post<ApiResponse<ProjectPhaseApiDTO>>(`${this.base}/project-phases`, dto)
      .pipe(map(r => r.data));
  }

  /** PUT /api/project-phases/{id} */
  updatePhase(id: number, dto: ProjectPhaseApiDTO): Observable<ProjectPhaseApiDTO> {
    return this.http
      .put<ApiResponse<ProjectPhaseApiDTO>>(`${this.base}/project-phases/${id}`, dto)
      .pipe(map(r => r.data));
  }

  /** DELETE /api/project-phases/{id} */
  deletePhase(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/project-phases/${id}`)
      .pipe(map(() => void 0));
  }

  // ─── Departments ─────────────────────────────────────────────────────────

  /** GET /api/departments */
  getAllDepartments(): Observable<DepartmentApiDTO[]> {
    return this.http
      .get<ApiResponse<DepartmentApiDTO[]>>(`${this.base}/departments`)
      .pipe(map(r => r.data ?? []));
  }

  /** POST /api/departments */
  createDepartment(name: string): Observable<DepartmentApiDTO> {
    return this.http
      .post<ApiResponse<DepartmentApiDTO>>(`${this.base}/departments`, { name })
      .pipe(map(r => r.data));
  }

  /** PUT /api/departments/{id} — đổi tên */
  renameDepartment(id: number, newName: string): Observable<DepartmentApiDTO> {
    return this.http
      .put<ApiResponse<DepartmentApiDTO>>(`${this.base}/departments/${id}`, { name: newName })
      .pipe(map(r => r.data));
  }

  /** DELETE /api/departments/{id} */
  deleteDepartment(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/departments/${id}`)
      .pipe(map(() => void 0));
  }

  /** POST /api/departments/seed — thêm phòng ban còn thiếu từ danh sách nhân viên */
  seedDepartments(names: string[]): Observable<DepartmentApiDTO[]> {
    return this.http
      .post<ApiResponse<DepartmentApiDTO[]>>(`${this.base}/departments/seed`, names)
      .pipe(map(r => r.data ?? []));
  }

  // ─── Audit Log ────────────────────────────────────────────────────────────

  /** GET /api/audit-logs — lịch sử thay đổi */
  getAuditLogs(params: {
    entityType?: string;
    action?: string;
    actor?: string;
    page?: number;
    size?: number;
  } = {}): Observable<AuditLogPage> {
    let p = new HttpParams();
    if (params.entityType) p = p.set('entityType', params.entityType);
    if (params.action)     p = p.set('action',     params.action);
    if (params.actor)      p = p.set('actor',      params.actor);
    if (params.page  != null) p = p.set('page',  String(params.page));
    if (params.size  != null) p = p.set('size',  String(params.size));
    return this.http
      .get<ApiResponse<AuditLogApiDTO[]>>(`${this.base}/audit-logs`, { params: p })
      .pipe(map(r => ({ data: r.data ?? [], total: r.total ?? 0 })));
  }
}

