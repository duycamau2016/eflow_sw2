import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Employee, Project } from '../../models/employee.model';
import { ExcelImportService } from '../../services/excel-import.service';

export type PanelMode = 'closed' | 'view' | 'edit' | 'create';

@Component({
  selector: 'app-employee-management',
  templateUrl: './employee-management.component.html',
  styleUrls: ['./employee-management.component.scss']
})
export class EmployeeManagementComponent implements OnChanges {
  @Input() allEmployees: Employee[] = [];

  // ─── List state ─────────────────────────────────────────────
  searchQuery  = '';
  deptFilter   = 'all';
  sortCol      = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  page         = 0;
  readonly pageSize = 10;

  // ─── Panel state ─────────────────────────────────────────────
  panelMode: PanelMode = 'closed';
  selectedEmployee: Employee | null = null;
  deleteConfirmId: string | null = null;  isSaving    = false;
  isDeleting: string | null = null;
  // ─── Form ─────────────────────────────────────────────────
  form: Partial<Employee> = {};
  formErrors: Record<string, string> = {};
  newProject: Partial<Project> = {};
  showAddProject = false;

  constructor(private excelService: ExcelImportService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allEmployees']) {
      this.page = 0;
    }
  }

  // ─── Computed lists ──────────────────────────────────────────
  get departments(): string[] {
    const s = new Set(this.allEmployees.map(e => e.department).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'vi'));
  }

  get filteredEmployees(): Employee[] {
    const q = this.searchQuery.toLowerCase();
    return this.allEmployees
      .filter(e => {
        const matchSearch = !q ||
          e.name.toLowerCase().includes(q) ||
          e.position?.toLowerCase().includes(q) ||
          e.department?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.id?.toLowerCase().includes(q);
        const matchDept = this.deptFilter === 'all' || e.department === this.deptFilter;
        return matchSearch && matchDept;
      })
      .sort((a, b) => {
        let va: any, vb: any;
        switch (this.sortCol) {
          case 'name':     va = a.name;       vb = b.name;       break;
          case 'position': va = a.position;   vb = b.position;   break;
          case 'dept':     va = a.department; vb = b.department; break;
          case 'level':    va = a.level;      vb = b.level;      break;
          case 'joinDate': va = a.joinDate;   vb = b.joinDate;   break;
          default:         va = a.name;       vb = b.name;
        }
        const cmp = typeof va === 'number'
          ? (va - vb)
          : String(va ?? '').localeCompare(String(vb ?? ''), 'vi');
        return this.sortDir === 'asc' ? cmp : -cmp;
      });
  }

  get pagedEmployees(): Employee[] {
    const start = this.page * this.pageSize;
    return this.filteredEmployees.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEmployees.length / this.pageSize));
  }

  get endIndex(): number {
    return Math.min((this.page + 1) * this.pageSize, this.filteredEmployees.length);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur   = this.page;
    let start   = Math.max(0, cur - 2);
    let end     = Math.min(total - 1, start + 4);
    start       = Math.max(0, end - 4);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ─── Helpers ─────────────────────────────────────────────────
  getManagerName(managerId: string | null): string {
    if (!managerId) return '—';
    const mgr = this.allEmployees.find(e => e.id === managerId);
    return mgr ? mgr.name : managerId;
  }

  getAvatarColor(name: string): string {
    const colors = ['#3f51b5','#009688','#ff5722','#9c27b0','#2196f3','#e91e63','#4caf50','#ff9800'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  getInitials(name: string): string {
    return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
  }

  getLevelLabel(level: number): string {
    const labels = ['Cấp 1','Cấp 2','Cấp 3','Cấp 4','Cấp 5','Cấp 6'];
    return labels[level] ?? `Cấp ${level + 1}`;
  }

  readonly statusLabel: Record<string, string> = {
    active: 'Đang thực hiện',
    completed: 'Hoàn thành',
    pending: 'Chờ triển khai'
  };

  getStatusClass(s: string) { return `status-${s}`; }

  // ─── Table interactions ──────────────────────────────────────
  sort(col: string): void {
    if (this.sortCol === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortCol = col; this.sortDir = 'asc'; }
    this.page = 0;
  }

  onSearch(): void { this.page = 0; }

  goTo(p: number): void {
    if (p >= 0 && p < this.totalPages) this.page = p;
  }

  // ─── Panel open/close ─────────────────────────────────────────
  openView(emp: Employee): void {
    this.selectedEmployee = emp;
    this.panelMode = 'view';
    this.deleteConfirmId = null;
    this.showAddProject = false;
  }

  switchToEdit(): void {
    if (!this.selectedEmployee) return;
    this.form = { ...this.selectedEmployee, projects: [...(this.selectedEmployee.projects ?? [])] };
    this.formErrors = {};
    this.showAddProject = false;
    this.panelMode = 'edit';
  }

  openEdit(emp: Employee, event?: Event): void {
    event?.stopPropagation();
    this.selectedEmployee = emp;
    this.form = { ...emp, projects: [...(emp.projects ?? [])] };
    this.formErrors = {};
    this.showAddProject = false;
    this.panelMode = 'edit';
    this.deleteConfirmId = null;
  }

  openCreate(): void {
    this.selectedEmployee = null;
    this.form = { id: '', name: '', position: '', department: '', email: '', phone: '', managerId: null, joinDate: '', projects: [] };
    this.formErrors = {};
    this.showAddProject = false;
    this.panelMode = 'create';
    this.deleteConfirmId = null;
  }

  closePanel(): void {
    this.panelMode = 'closed';
    this.deleteConfirmId = null;
    this.showAddProject = false;
  }

  // ─── Validation + Save ──────────────────────────────────────
  validate(): boolean {
    this.formErrors = {};
    if (!this.form.name?.trim())
      this.formErrors['name'] = 'Họ tên không được để trống';
    if (!this.form.position?.trim())
      this.formErrors['position'] = 'Chức vụ không được để trống';
    if (!this.form.department?.trim())
      this.formErrors['department'] = 'Phòng ban không được để trống';
    if (this.panelMode === 'create') {
      if (!this.form.id?.trim())
        this.formErrors['id'] = 'Mã nhân viên không được để trống';
      else if (this.allEmployees.find(e => e.id === this.form.id?.trim()))
        this.formErrors['id'] = 'Mã nhân viên đã tồn tại';
    }
    if (this.form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email))
      this.formErrors['email'] = 'Email không hợp lệ';
    return Object.keys(this.formErrors).length === 0;
  }

  saveEmployee(): void {
    if (!this.validate()) return;
    const emp: Employee = {
      id:        (this.form.id ?? '').trim(),
      name:      (this.form.name ?? '').trim(),
      position:  (this.form.position ?? '').trim(),
      department:(this.form.department ?? '').trim(),
      email:     (this.form.email ?? '').trim(),
      phone:     (this.form.phone ?? '').trim(),
      managerId: this.form.managerId || null,
      joinDate:  this.form.joinDate ?? '',
      level:     0,
      projects:  (this.form.projects?.length ? this.form.projects as Project[] : null),
      children:  [],
      avatar:    ''
    };
    this.isSaving = true;
    const op$ = this.panelMode === 'create'
      ? this.excelService.addEmployee(emp)
      : this.excelService.updateEmployee(emp);
    op$.subscribe({
      next: () => { this.isSaving = false; this.closePanel(); },
      error: ()  => { this.isSaving = false; }
    });
  }

  // ─── Project CRUD inside form ────────────────────────────────
  removeProjectFromForm(index: number): void {
    (this.form.projects as Project[]).splice(index, 1);
  }

  addProjectToForm(): void {
    if (!this.newProject.name?.trim()) return;
    const p: Project = {
      id: `proj_new_${Date.now()}`,
      name:      (this.newProject.name ?? '').trim(),
      role:      (this.newProject.role ?? '').trim(),
      startDate: this.newProject.startDate ?? '',
      endDate:   this.newProject.endDate ?? '',
      status:    this.newProject.status ?? 'active'
    };
    if (!this.form.projects) this.form.projects = [];
    (this.form.projects as Project[]).push(p);
    this.newProject = {};
    this.showAddProject = false;
  }

  // ─── Delete ───────────────────────────────────────────────────
  confirmDelete(id: string, event?: Event): void {
    event?.stopPropagation();
    this.deleteConfirmId = id;
  }

  cancelDelete(): void { this.deleteConfirmId = null; }

  doDelete(id: string): void {
    this.isDeleting = id;
    this.excelService.deleteEmployee(id).subscribe({
      next: () => {
        this.isDeleting = null;
        if (this.selectedEmployee?.id === id) this.closePanel();
        this.deleteConfirmId = null;
        if (this.page >= this.totalPages) this.page = Math.max(0, this.totalPages - 1);
      },
      error: () => {
        this.isDeleting = null;
        this.deleteConfirmId = null;
      }
    });
  }
}
