import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { Employee, Project, ImportResult, OrgNode } from '../models/employee.model';

@Injectable({
  providedIn: 'root'
})
export class ExcelImportService {
  private employeesSubject = new BehaviorSubject<Employee[]>([]);
  private orgTreeSubject = new BehaviorSubject<OrgNode[]>([]);

  employees$ = this.employeesSubject.asObservable();
  orgTree$ = this.orgTreeSubject.asObservable();

  constructor(private http: HttpClient) {}

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
              projects: projectMap.get(id) || [],
              children: [],
              avatar: this.generateAvatar(String(row[1] || ''))
            };

            employees.push(employee);
          }

          // Build hierarchy tree
          const tree = this.buildOrgTree(employees);
          this.employeesSubject.next(employees);
          this.orgTreeSubject.next(tree);

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
        projects: projectMap.get(id) || [],
        children: [],
        avatar: this.generateAvatar(String(row[1] || ''))
      });
    }

    const tree = this.buildOrgTree(employees);
    this.employeesSubject.next(employees);
    this.orgTreeSubject.next(tree);

    return { success: true, employees, errors, total: employees.length };
  }

  clearData(): void {
    this.employeesSubject.next([]);
    this.orgTreeSubject.next([]);
  }

  addEmployee(emp: Employee): void {
    const current = this.employeesSubject.getValue();
    const updated = [...current, emp];
    const tree = this.buildOrgTree(updated);
    this.employeesSubject.next(updated);
    this.orgTreeSubject.next(tree);
  }

  updateEmployee(emp: Employee): void {
    const current = this.employeesSubject.getValue();
    const updated = current.map(e => e.id === emp.id ? { ...emp, projects: emp.projects ?? e.projects } : e);
    const tree = this.buildOrgTree(updated);
    this.employeesSubject.next(updated);
    this.orgTreeSubject.next(tree);
  }

  deleteEmployee(id: string): void {
    const current = this.employeesSubject.getValue();
    // Remove employee + clear their managerId from subordinates
    const updated = current
      .filter(e => e.id !== id)
      .map(e => e.managerId === id ? { ...e, managerId: null } : e);
    const tree = this.buildOrgTree(updated);
    this.employeesSubject.next(updated);
    this.orgTreeSubject.next(tree);
  }

  getEmployees(): Employee[] {
    return this.employeesSubject.getValue();
  }
}
