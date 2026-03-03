import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Employee, Project } from '../../models/employee.model';
import { ExcelImportService } from '../../services/excel-import.service';

export type PanelMode = 'closed' | 'view' | 'edit' | 'create';

export interface ChecklistItem {
  id: string;
  label: string;
  category: 'it' | 'hr' | 'onboarding';
  done: boolean;
}

@Component({
  selector: 'app-employee-management',
  templateUrl: './employee-management.component.html',
  styleUrls: ['./employee-management.component.scss']
})
export class EmployeeManagementComponent implements OnChanges, OnInit {
  @Input() allEmployees: Employee[] = [];
  @Input() isAdmin = false;

  // ─── Workload ────────────────────────────────────────────────
  readonly WORKLOAD_THRESHOLD = 3;

  // ─── Onboarding checklist ────────────────────────────────────
  private readonly DEFAULT_CHECKLIST: ChecklistItem[] = [
    { id: 'it1', label: 'Cấp email công ty',                category: 'it',         done: false },
    { id: 'it2', label: 'Cấp máy tính / laptop',              category: 'it',         done: false },
    { id: 'it3', label: 'Cài đặt phần mềm cần thiết',        category: 'it',         done: false },
    { id: 'it4', label: 'Cấp tài khoản hệ thống (Jira, Slack…)', category: 'it',         done: false },
    { id: 'hr1', label: 'Ký hợp đồng lao động',               category: 'hr',         done: false },
    { id: 'hr2', label: 'Cấp thẻ nhân viên',                 category: 'hr',         done: false },
    { id: 'hr3', label: 'Đăng ký bảo hiểm xã hội',           category: 'hr',         done: false },
    { id: 'hr4', label: 'Chụp ảnh hồ sơ công ty',             category: 'hr',         done: false },
    { id: 'ob1', label: 'Giới thiệu với team',               category: 'onboarding', done: false },
    { id: 'ob2', label: 'Đào tạo quy trình làm việc',         category: 'onboarding', done: false },
    { id: 'ob3', label: 'Hướng dẫn nội quy công ty',          category: 'onboarding', done: false },
    { id: 'ob4', label: 'Tham quan / làm quen văn phòng',     category: 'onboarding', done: false },
  ];
  checklistMap: Record<string, ChecklistItem[]> = {};

  // ─── List state ─────────────────────────────────────────────
  searchQuery        = '';
  deptFilter         = 'all';
  levelFilter        = 'all';
  showOnlyOverloaded = false;
  showOnlyBench      = false;
  sortCol            = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  page               = 0;
  readonly pageSize  = 10;

  // ─── Panel state ─────────────────────────────────────────────
  panelMode: PanelMode = 'closed';
  selectedEmployee: Employee | null = null;
  deleteConfirmId: string | null = null;

  // ─── Loading state ───────────────────────────────────────────
  isSaving = false;
  deletingId: string | null = null;
  // ─── Form ─────────────────────────────────────────────────
  form: Partial<Employee> = {};
  formErrors: Record<string, string> = {};
  newProject: Partial<Project> = {};
  showAddProject = false;

  // ─── Cached options (tránh tạo array mới mỗi change detection) ──
  deptSelectOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Tất cả phòng ban' }
  ];

  constructor(private excelService: ExcelImportService) {}

  ngOnInit(): void { this.loadChecklist(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allEmployees']) {
      this.page = 0;
      this.rebuildDeptOptions();
    }
  }

  private rebuildDeptOptions(): void {
    const s = new Set(this.allEmployees.map(e => e.department).filter(Boolean));
    const sorted = Array.from(s).sort((a, b) => a.localeCompare(b, 'vi'));
    this.deptSelectOptions = [
      { value: 'all', label: 'Tất cả phòng ban' },
      ...sorted.map(d => ({ value: d, label: d }))
    ];
  }

  // ─── Computed lists ──────────────────────────────────────────
  get departments(): string[] {
    const s = new Set(this.allEmployees.map(e => e.department).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'vi'));
  }

  get managerSelectOptions() {
    return this.allEmployees
      .filter(e => e.id !== this.form.id)
      .map(e => ({ value: e.id, label: `${e.name} (${e.position ?? ''})` }));
  }

  readonly statusSelectOptions = [
    { value: 'active',    label: 'Đang thực hiện' },
    { value: 'pending',   label: 'Chờ triển khai'  },
    { value: 'completed', label: 'Hoàn thành'       }
  ];

  readonly levelSelectOptions = [
    { value: 'all', label: 'Tất cả cấp bậc' },
    { value: '0',   label: 'Cấp 1' },
    { value: '1',   label: 'Cấp 2' },
    { value: '2',   label: 'Cấp 3' },
    { value: '3',   label: 'Cấp 4' },
    { value: '4',   label: 'Cấp 5' },
    { value: '5',   label: 'Cấp 6' },
  ];

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
        const matchDept     = this.deptFilter === 'all' || e.department === this.deptFilter;
        const matchLevel    = this.levelFilter === 'all' || e.level === +this.levelFilter;
        const matchOverload = !this.showOnlyOverloaded || this.getActiveProjectCount(e) > this.WORKLOAD_THRESHOLD;
        const matchBench    = !this.showOnlyBench    || this.getActiveProjectCount(e) === 0;
        return matchSearch && matchDept && matchLevel && matchOverload && matchBench;
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

  // ─── Workload helpers ────────────────────────────────────────
  getActiveProjectCount(emp: Employee): number {
    return (emp.projects ?? []).filter(p => p.status === 'active').length;
  }

  getWorkloadLevel(emp: Employee): 'ok' | 'busy' | 'overload' {
    const a = this.getActiveProjectCount(emp);
    if (a > this.WORKLOAD_THRESHOLD) return 'overload';
    if (a >= 2) return 'busy';
    return 'ok';
  }

  get overloadedCount(): number {
    return this.allEmployees.filter(e => this.getActiveProjectCount(e) > this.WORKLOAD_THRESHOLD).length;
  }

  get benchCount(): number {
    return this.allEmployees.filter(e => this.getActiveProjectCount(e) === 0).length;
  }

  // ─── Onboarding checklist ────────────────────────────────────
  private loadChecklist(): void {
    try {
      const saved = localStorage.getItem('eflow_onboarding');
      if (saved) this.checklistMap = JSON.parse(saved);
    } catch {}
  }

  private saveChecklist(): void {
    localStorage.setItem('eflow_onboarding', JSON.stringify(this.checklistMap));
  }

  getChecklist(empId: string): ChecklistItem[] {
    if (!this.checklistMap[empId]) {
      this.checklistMap[empId] = this.DEFAULT_CHECKLIST.map(i => ({ ...i }));
      this.saveChecklist();
    }
    return this.checklistMap[empId];
  }

  getChecklistByCategory(empId: string, cat: ChecklistItem['category']): ChecklistItem[] {
    return this.getChecklist(empId).filter(i => i.category === cat);
  }

  getChecklistProgress(empId: string): { done: number; total: number; pct: number } {
    const list = this.getChecklist(empId);
    const done = list.filter(i => i.done).length;
    return { done, total: list.length, pct: Math.round((done / list.length) * 100) };
  }

  toggleCheckItem(empId: string, itemId: string): void {
    const item = this.getChecklist(empId).find(i => i.id === itemId);
    if (item) { item.done = !item.done; this.saveChecklist(); }
  }

  resetChecklist(empId: string): void {
    this.checklistMap[empId] = this.DEFAULT_CHECKLIST.map(i => ({ ...i }));
    this.saveChecklist();
  }

  // ─── Helpers ─────────────────────────────────────────────────
  /** Tính thâm niên từ ngày vào làm đến hiện tại */
  getTenure(joinDate: string): string {
    if (!joinDate) return '';
    let date: Date | null = null;
    const dmy = joinDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) date = new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    else {
      const ymd = joinDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymd) date = new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
    }
    if (!date || isNaN(date.getTime())) return '';
    const now = new Date();
    let years = now.getFullYear() - date.getFullYear();
    let months = now.getMonth() - date.getMonth();
    if (months < 0) { years--; months += 12; }
    if (years === 0 && months === 0) return 'Mới vào';
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    return parts.join(' ');
  }

  /** Gợi ý mã NV tiếp theo theo dạng NV001, NV002... */
  private suggestNextEmployeeId(): string {
    const max = this.allEmployees
      .map(e => { const m = e.id?.match(/^NV(\d+)$/i); return m ? +m[1] : 0; })
      .reduce((a, b) => Math.max(a, b), 0);
    return max > 0 ? `NV${String(max + 1).padStart(3, '0')}` : '';
  }

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

  get hasActiveFilters(): boolean {
    return this.searchQuery !== '' || this.deptFilter !== 'all' || this.levelFilter !== 'all' || this.showOnlyOverloaded || this.showOnlyBench;
  }

  clearFilters(): void {
    this.searchQuery        = '';
    this.deptFilter         = 'all';
    this.levelFilter        = 'all';
    this.showOnlyOverloaded = false;
    this.showOnlyBench      = false;
    this.page               = 0;
  }

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
    this.form = { id: this.suggestNextEmployeeId(), name: '', position: '', department: '', email: '', phone: '', managerId: null, joinDate: '', projects: [] };
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
    if (this.form.email?.trim() && !this.formErrors['email']) {
      const dup = this.allEmployees.find(e =>
        e.email?.toLowerCase() === this.form.email!.trim().toLowerCase() && e.id !== this.form.id
      );
      if (dup) this.formErrors['email'] = `Email đã được dùng bởi ${dup.name}`;
    }
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
    this.deletingId = id;
    this.excelService.deleteEmployee(id).subscribe({
      next: () => {
        this.deletingId = null;
        if (this.selectedEmployee?.id === id) this.closePanel();
        this.deleteConfirmId = null;
        if (this.page >= this.totalPages) this.page = Math.max(0, this.totalPages - 1);
      },
      error: () => {
        this.deletingId = null;
        this.deleteConfirmId = null;
      }
    });
  }
}
