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
}
