import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { Employee, Project, ImportResult, OrgNode } from '../models/employee.model';
import { EFlowApiService, EmployeeApiDTO, ProjectApiDTO } from './eflow-api.service';

@Injectable({
  providedIn: 'root'
})
export class ExcelImportService {
  private employeesSubject = new BehaviorSubject<Employee[]>([]);
  private orgTreeSubject = new BehaviorSubject<OrgNode[]>([]);

  employees$ = this.employeesSubject.asObservable();
  orgTree$ = this.orgTreeSubject.asObservable();

  constructor(
    private http: HttpClient,
    private eflowApi: EFlowApiService
  ) {}

  /**
   * Parse file Excel và trả về danh sách nhân viên
   * Cấu trúc Excel:
   * Sheet "Nhân sự": ID | Họ tên | Chức vụ | Phòng ban | Email | SĐT | ID quản lý | Ngày vào làm
   * Sheet "Dự án":   ID nhân viên | Tên dự án | Vai trò | Ngày bắt đầu | Ngày kết thúc | Trạng thái
   */
  async parseExcelFile(file: File): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const errors: string[] = [];

      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });

          const employees: Employee[] = [];
          const projectMap = new Map<string, Project[]>();

          // -----------------------------------------------
          // Đọc sheet dự án trước (nếu có)
          // -----------------------------------------------
          const projectSheetName = workbook.SheetNames.find(
            n => n.toLowerCase().includes('dự án') ||
                 n.toLowerCase().includes('du an') ||
                 n.toLowerCase().includes('project')
          );

          if (projectSheetName) {
            const projectSheet = workbook.Sheets[projectSheetName];
            const projectRows: any[] = XLSX.utils.sheet_to_json(projectSheet, {
              header: 1,
              defval: ''
            });

            // Bỏ qua dòng header (dòng đầu)
            for (let i = 1; i < projectRows.length; i++) {
              const row = projectRows[i];
              if (!row[0]) continue;

              const empId = String(row[0]).trim();
              const project: Project = {
                id: `proj_${i}`,
                name: String(row[1] || '').trim(),
                role: String(row[2] || '').trim(),
                startDate: this.formatDate(row[3]),
                endDate: this.formatDate(row[4]),
                status: this.parseProjectStatus(String(row[5] || ''))
              };

              if (!projectMap.has(empId)) {
                projectMap.set(empId, []);
              }
              projectMap.get(empId)!.push(project);
            }
          }

          // -----------------------------------------------
          // Đọc sheet nhân sự
          // -----------------------------------------------
          const hrSheetName = workbook.SheetNames.find(
            n => n.toLowerCase().includes('nhân sự') ||
                 n.toLowerCase().includes('nhan su') ||
                 n.toLowerCase().includes('employee') ||
                 n.toLowerCase().includes('hr')
          ) || workbook.SheetNames[0];

          const hrSheet = workbook.Sheets[hrSheetName];
          const hrRows: any[] = XLSX.utils.sheet_to_json(hrSheet, {
            header: 1,
            defval: ''
          });

          for (let i = 1; i < hrRows.length; i++) {
            const row = hrRows[i];
            if (!row[0] && !row[1]) continue;

            const id = String(row[0] || `EMP_${i}`).trim();
            const name = String(row[1] || '').trim();

            if (!name) {
              errors.push(`Dòng ${i + 1}: Thiếu họ tên nhân viên`);
              continue;
            }

            const employee: Employee = {
              id,
              name,
              position: String(row[2] || '').trim(),
              department: String(row[3] || '').trim(),
              email: String(row[4] || '').trim(),
              phone: String(row[5] || '').trim(),
              managerId: row[6] ? String(row[6]).trim() : null,
              joinDate: this.formatDate(row[7]),
              level: 0,
              projects: projectMap.get(id) || null,
              children: [],
              avatar: this.generateAvatar(String(row[1] || ''))
            };

            employees.push(employee);
          }

          // Build hierarchy tree
          const tree = this.buildOrgTree(employees);
          this.employeesSubject.next(employees);
          this.orgTreeSubject.next(tree);

          // Sync to Spring Boot backend (fire-and-forget)
          this._syncToApi(employees);

          resolve({
            success: true,
            employees,
            errors,
            total: employees.length
          });

        } catch (err: any) {
          reject({ success: false, employees: [], errors: [err.message], total: 0 });
        }
      };

      reader.onerror = () => reject({ success: false, employees: [], errors: ['Không thể đọc file'], total: 0 });
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Xây dựng cây phân cấp từ danh sách nhân viên phẳng
   */
  buildOrgTree(employees: Employee[]): OrgNode[] {
    const map = new Map<string, OrgNode>();
    const roots: OrgNode[] = [];

    // Tạo node cho mỗi nhân viên
    employees.forEach(emp => {
      map.set(emp.id, { employee: emp, children: [], isExpanded: true });
    });

    // Gán con cho cha
    employees.forEach(emp => {
      const node = map.get(emp.id)!;
      if (emp.managerId && map.has(emp.managerId)) {
        const parentNode = map.get(emp.managerId)!;
        parentNode.children.push(node);
        node.depth = (parentNode.depth ?? 0) + 1;
      } else {
        node.depth = 0;
        roots.push(node);
      }
    });

    // Tính level cho từng nhân viên
    this.assignLevels(roots, 0);

    // Tính số lượng cấp dưới
    employees.forEach(emp => {
      emp.subordinatesCount = this.countSubordinates(map.get(emp.id)!);
    });

    return roots;
  }

  private assignLevels(nodes: OrgNode[], level: number): void {
    nodes.forEach(node => {
      node.employee.level = level;
      node.depth = level;
      if (node.children.length > 0) {
        this.assignLevels(node.children, level + 1);
      }
    });
  }

  private countSubordinates(node: OrgNode): number {
    let count = node.children.length;
    node.children.forEach(child => {
      count += this.countSubordinates(child);
    });
    return count;
  }

  private formatDate(value: any): string {
    if (!value) return '';
    if (value instanceof Date) {
      const d = String(value.getDate()).padStart(2, '0');
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const y = value.getFullYear();
      return `${d}/${m}/${y}`;
    }
    if (typeof value === 'number') {
      // Fallback: Excel serial date formula
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      const d = String(date.getUTCDate()).padStart(2, '0');
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const y = date.getUTCFullYear();
      return `${d}/${m}/${y}`;
    }
    return String(value).trim();
  }

  private parseProjectStatus(status: string): 'active' | 'completed' | 'pending' {
    const s = status.toLowerCase();
    if (s.includes('active') || s.includes('đang') || s.includes('hoạt động')) return 'active';
    if (s.includes('complet') || s.includes('hoàn thành') || s.includes('xong')) return 'completed';
    return 'pending';
  }

  private generateAvatar(name: string): string {
    const colors = ['#3f51b5', '#e91e63', '#009688', '#ff5722', '#607d8b', '#795548', '#9c27b0', '#03a9f4'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  /**
   * Tải về file Excel mẫu
   */
  downloadTemplate(): void {
    const wb = XLSX.utils.book_new();

    // Sheet Nhân sự
    const hrData = [
      ['ID', 'Họ và tên', 'Chức vụ', 'Phòng ban', 'Email', 'Số điện thoại', 'ID quản lý', 'Ngày vào làm'],
      ['NV001', 'Nguyễn Văn An', 'Giám đốc', 'Ban Giám đốc', 'an.nv@company.com', '0901234567', '', '01/01/2020'],
      ['NV002', 'Trần Thị Bình', 'Trưởng phòng IT', 'Phòng IT', 'binh.tt@company.com', '0901234568', 'NV001', '01/03/2020'],
      ['NV003', 'Lê Minh Cường', 'Trưởng phòng HR', 'Phòng Nhân sự', 'cuong.lm@company.com', '0901234569', 'NV001', '15/06/2020'],
      ['NV004', 'Phạm Thị Dung', 'Lập trình viên', 'Phòng IT', 'dung.pt@company.com', '0901234570', 'NV002', '01/08/2021'],
      ['NV005', 'Hoàng Văn Em', 'Lập trình viên', 'Phòng IT', 'em.hv@company.com', '0901234571', 'NV002', '15/09/2021'],
      ['NV006', 'Nguyễn Thị Fay', 'HR Specialist', 'Phòng Nhân sự', 'fay.nt@company.com', '0901234572', 'NV003', '01/10/2021'],
    ];

    // Sheet Dự án
    const projectData = [
      ['ID nhân viên', 'Tên dự án', 'Vai trò', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái'],
      ['NV002', 'Hệ thống ERP', 'Project Manager', '01/01/2024', '31/12/2024', 'active'],
      ['NV004', 'Hệ thống ERP', 'Backend Developer', '01/01/2024', '31/12/2024', 'active'],
      ['NV005', 'Website Công ty', 'Frontend Developer', '01/03/2024', '30/06/2024', 'completed'],
      ['NV006', 'Tuyển dụng Q1', 'Lead', '01/01/2024', '31/03/2024', 'completed'],
      ['NV002', 'Mobile App', 'Tech Lead', '01/07/2024', '', 'active'],
    ];

    const hrSheet = XLSX.utils.aoa_to_sheet(hrData);
    const projectSheet = XLSX.utils.aoa_to_sheet(projectData);

    // Style column widths
    hrSheet['!cols'] = [
      { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
    ];
    projectSheet['!cols'] = [
      { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, hrSheet, 'Nhân sự');
    XLSX.utils.book_append_sheet(wb, projectSheet, 'Dự án');

    XLSX.writeFile(wb, 'mau_nhan_su_phan_cap.xlsx');
  }

  /**
   * Tải dữ liệu Excel từ URL (dùng cho file mẫu trong assets)
   */
  async loadFromUrl(url: string): Promise<ImportResult> {
    const arrayBuffer = await this.http.get(url, { responseType: 'arraybuffer' }).toPromise();
    const data = new Uint8Array(arrayBuffer!);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

    const fakeFile = {
      name: url.split('/').pop() || 'sample.xlsx',
      arrayBuffer: async () => arrayBuffer as ArrayBuffer
    } as unknown as File;

    // Reuse the existing parse logic by passing raw data directly
    return this._parseWorkbook(workbook);
  }

  private _parseWorkbook(workbook: XLSX.WorkBook): ImportResult {
    const errors: string[] = [];
    const employees: Employee[] = [];
    const projectMap = new Map<string, Project[]>();

    const projectSheetName = workbook.SheetNames.find(
      n => n.toLowerCase().includes('dự án') ||
           n.toLowerCase().includes('du an') ||
           n.toLowerCase().includes('project')
    );

    if (projectSheetName) {
      const projectSheet = workbook.Sheets[projectSheetName];
      const projectRows: any[] = XLSX.utils.sheet_to_json(projectSheet, { header: 1, defval: '' });
      for (let i = 1; i < projectRows.length; i++) {
        const row = projectRows[i];
        if (!row[0]) continue;
        const empId = String(row[0]).trim();
        const project: Project = {
          id: `proj_${i}`,
          name: String(row[1] || '').trim(),
          role: String(row[2] || '').trim(),
          startDate: this.formatDate(row[3]),
          endDate: this.formatDate(row[4]),
          status: this.parseProjectStatus(String(row[5] || ''))
        };
        if (!projectMap.has(empId)) projectMap.set(empId, []);
        projectMap.get(empId)!.push(project);
      }
    }

    const hrSheetName = workbook.SheetNames.find(
      n => n.toLowerCase().includes('nhân sự') ||
           n.toLowerCase().includes('nhan su') ||
           n.toLowerCase().includes('employee') ||
           n.toLowerCase().includes('hr')
    ) || workbook.SheetNames[0];

    const hrSheet = workbook.Sheets[hrSheetName];
    const hrRows: any[] = XLSX.utils.sheet_to_json(hrSheet, { header: 1, defval: '' });

    for (let i = 1; i < hrRows.length; i++) {
      const row = hrRows[i];
      if (!row[0] && !row[1]) continue;
      const id = String(row[0] || `EMP_${i}`).trim();
      const name = String(row[1] || '').trim();
      if (!name) { errors.push(`Dòng ${i + 1}: Thiếu họ tên nhân viên`); continue; }
      employees.push({
        id, name,
        position: String(row[2] || '').trim(),
        department: String(row[3] || '').trim(),
        email: String(row[4] || '').trim(),
        phone: String(row[5] || '').trim(),
        managerId: row[6] ? String(row[6]).trim() : null,
        joinDate: this.formatDate(row[7]),
        level: 0,
        projects: projectMap.get(id) || null,
        children: [],
        avatar: this.generateAvatar(String(row[1] || ''))
      });
    }

    const tree = this.buildOrgTree(employees);
    this.employeesSubject.next(employees);
    this.orgTreeSubject.next(tree);

    // Sync to Spring Boot backend (fire-and-forget)
    this._syncToApi(employees);

    return { success: true, employees, errors, total: employees.length };
  }

  clearData(): void {
    this.employeesSubject.next([]);
    this.orgTreeSubject.next([]);
  }

  addEmployee(emp: Employee): Observable<Employee> {
    const dto = this.employeeToDTO(emp);
    const doCreate = () => this.eflowApi.createEmployee(dto).pipe(
      map(saved => {
        const result = this.dtoToEmployee(saved);
        const current = [...this.employeesSubject.getValue(), result];
        this.employeesSubject.next(current);
        this.orgTreeSubject.next(this.buildOrgTree(current));
        return result;
      })
    );
    return doCreate().pipe(
      catchError(err => {
        // H2 có thể trống sau restart → sync lại rồi retry
        if (err?.status === 404 || err?.status === 0) {
          return this._resyncThenRun<Employee>(doCreate, () => {
            const current = [...this.employeesSubject.getValue(), emp];
            this.employeesSubject.next(current);
            this.orgTreeSubject.next(this.buildOrgTree(current));
            return of(emp);
          });
        }
        // 403 Forbidden — không được phép tạo: ném lỗi để component xử lý + hiển thị toast
        if (err?.status === 403) return throwError(() => err);
        console.warn('[eFlow] createEmployee API error, updating local state:', err);
        const current = [...this.employeesSubject.getValue(), emp];
        this.employeesSubject.next(current);
        this.orgTreeSubject.next(this.buildOrgTree(current));
        return of(emp);
      })
    );
  }

  updateEmployee(emp: Employee): Observable<Employee> {
    const dto = this.employeeToDTO(emp);
    const doUpdate = () => this.eflowApi.updateEmployee(emp.id, dto).pipe(
      map(saved => {
        const result = this.dtoToEmployee(saved);
        const current = this.employeesSubject.getValue().map(e => e.id === result.id ? result : e);
        this.employeesSubject.next(current);
        this.orgTreeSubject.next(this.buildOrgTree(current));
        return result;
      })
    );
    return doUpdate().pipe(
      catchError(err => {
        // H2 trống sau restart → sync toàn bộ data lên H2 rồi retry
        if (err?.status === 404 || err?.status === 0) {
          return this._resyncThenRun<Employee>(doUpdate, () => {
            const current = this.employeesSubject.getValue().map(e => e.id === emp.id ? { ...emp } : e);
            this.employeesSubject.next(current);
            this.orgTreeSubject.next(this.buildOrgTree(current));
            return of(emp);
          });
        }
        // 403 Forbidden — Manager không được phép sửa: ném lỗi để component hiển thị toast
        if (err?.status === 403) return throwError(() => err);
        console.warn('[eFlow] updateEmployee API error, updating local state:', err);
        const current = this.employeesSubject.getValue().map(e => e.id === emp.id ? { ...emp } : e);
        this.employeesSubject.next(current);
        this.orgTreeSubject.next(this.buildOrgTree(current));
        return of(emp);
      })
    );
  }

  deleteEmployee(id: string): Observable<void> {
    const doDelete = () => this.eflowApi.deleteEmployee(id).pipe(
      map(() => { this._removeFromLocalState(id); })
    );
    return doDelete().pipe(
      catchError(err => {
        if (err?.status === 404 || err?.status === 0) {
          return this._resyncThenRun<void>(doDelete, () => {
            this._removeFromLocalState(id);
            return of(void 0);
          });
        }
        // 403 Forbidden — Manager không được phép xóa: ném lỗi để component hiển thị toast
        if (err?.status === 403) return throwError(() => err);
        console.warn('[eFlow] deleteEmployee API error, updating local state:', err);
        this._removeFromLocalState(id);
        return of(void 0);
      })
    );
  }

  /**
   * Khi H2 trống (sau BE restart), tự động bulk-import dữ liệu hiện tại
   * lên H2 rồi thực hiện lại thao tác gốc. Nếu retry vẫn lỗi, chạy fallback.
   */
  private _resyncThenRun<T>(
    operation: () => Observable<T>,
    fallback: () => Observable<T>
  ): Observable<T> {
    const allEmps = this.employeesSubject.getValue();
    const dtos = allEmps.map(e => this.employeeToDTO(e));
    console.log('[eFlow] H2 empty detected — re-syncing', dtos.length, 'employees then retrying...');
    return this.eflowApi.bulkImport(dtos).pipe(
      switchMap(() => operation()),
      catchError(retryErr => {
        console.warn('[eFlow] Retry after resync failed:', retryErr);
        return fallback();
      })
    );
  }

  private _removeFromLocalState(id: string): void {
    const current = this.employeesSubject.getValue()
      .filter(e => e.id !== id)
      .map(e => e.managerId === id ? { ...e, managerId: null } : e);
    const tree = this.buildOrgTree(current);
    this.employeesSubject.next(current);
    this.orgTreeSubject.next(tree);
  }

  getEmployees(): Employee[] {
    return this.employeesSubject.getValue();
  }

  // ─── API Integration ─────────────────────────────────────────────────────

  /**
   * Tải toàn bộ nhân viên từ Spring Boot API và cập nhật local state.
   * Dùng khi khởi động app hoặc cần load lại từ server.
   */
  loadFromApi(): Observable<ImportResult> {
    return this.eflowApi.getAllEmployees().pipe(
      map(dtos => {
        const employees = dtos.map(dto => this.dtoToEmployee(dto));
        const tree = this.buildOrgTree(employees);
        this.employeesSubject.next(employees);
        this.orgTreeSubject.next(tree);
        return { success: true, employees, errors: [], total: employees.length } as ImportResult;
      })
    );
  }

  /** Bulk sync toàn bộ danh sách nhân viên lên API (fire-and-forget) */
  private _syncToApi(employees: Employee[]): void {
    const dtos = employees.map(e => this.employeeToDTO(e));
    this.eflowApi.bulkImport(dtos)
      .pipe(catchError(err => {
        console.warn('[eFlow] Bulk sync to API failed (offline mode):', err);
        return of(void 0);
      }))
      .subscribe(() => console.log(`[eFlow] Synced ${dtos.length} employees to API`));
  }

  // ─── Converters ──────────────────────────────────────────────────────────

  /** Angular Employee → API DTO */
  employeeToDTO(emp: Employee): EmployeeApiDTO {
    return {
      id: emp.id,
      name: emp.name,
      position: emp.position,
      department: emp.department,
      email: emp.email,
      phone: emp.phone,
      managerId: emp.managerId,
      avatar: emp.avatar,
      level: emp.level,
      joinDate: this.toISODate(emp.joinDate),
      projects: (emp.projects ?? []).map(p => this.projectToDTO(p, emp.id)),
    };
  }

  /** API DTO → Angular Employee */
  dtoToEmployee(dto: EmployeeApiDTO): Employee {
    return {
      id: dto.id,
      name: dto.name,
      position: dto.position,
      department: dto.department,
      email: dto.email || '',
      phone: dto.phone || '',
      managerId: dto.managerId,
      joinDate: this.fromISODate(dto.joinDate),
      level: dto.level ?? 0,
      avatar: dto.avatar || this.generateAvatar(dto.name),
      projects: dto.projects ? dto.projects.map(p => this.dtoToProject(p)) : null,
      children: [],
      subordinatesCount: dto.subordinatesCount ?? 0,
    };
  }

  private projectToDTO(proj: Project, employeeId: string): ProjectApiDTO {
    return {
      id: proj.id,
      employeeId,
      name: proj.name,
      role: proj.role,
      startDate: this.toISODate(proj.startDate),
      endDate: this.toISODate(proj.endDate),
      status: proj.status,
    };
  }

  private dtoToProject(dto: ProjectApiDTO): Project {
    return {
      id: dto.id,
      name: dto.name,
      role: dto.role,
      startDate: this.fromISODate(dto.startDate),
      endDate: this.fromISODate(dto.endDate),
      status: dto.status,
    };
  }

  /**
   * Chuyển chuỗi ngày dd/MM/yyyy → ISO yyyy-MM-dd.
   * Nếu đã là ISO hoặc rỗng thì trả về nguyên bản.
   */
  private toISODate(value?: string): string | undefined {
    if (!value) return undefined;
    const parts = value.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; // already ISO
    return undefined;
  }

  /**
   * Chuyển ISO yyyy-MM-dd → dd/MM/yyyy cho Angular UI.
   */
  private fromISODate(value?: string): string {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return value;
  }
}
