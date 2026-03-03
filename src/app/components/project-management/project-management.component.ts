import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { Employee } from '../../models/employee.model';
import { EFlowApiService, ProjectApiDTO, ProjectInfoApiDTO, InvoiceMilestoneApiDTO, ProjectPhaseApiDTO } from '../../services/eflow-api.service';
import { ExcelImportService } from '../../services/excel-import.service';
import { ExportService } from '../../services/export.service';

export interface ProjectInfo {
  /** = project name – dùng làm key */
  id: string;
  name: string;
  status: 'active' | 'completed' | 'pending';
  memberCount: number;
  members: ProjectMember[];
  endDate?: string;   // Ngày kết thúc tổng hợp (max endDate của các thành viên)
}

export interface ProjectMember {
  /** ID của bản ghi Project (assignment) trong DB */
  assignmentId: string;
  employee: Employee;
  role: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending';
  children: ProjectMember[];
}

type PanelMode = 'closed' | 'create-project' | 'edit-project' | 'add-member' | 'edit-member';

@Component({
  selector: 'app-project-management',
  templateUrl: './project-management.component.html',
  styleUrls: ['./project-management.component.scss']
})
export class ProjectManagementComponent implements OnChanges {
  @Input() allEmployees: Employee[] = [];
  @Input() isAdmin = false;
  @Input() autoSelectProject: string | null = null;
  @ViewChild('treeWrapper') treeWrapperRef!: ElementRef<HTMLElement>;

  // ── Dữ liệu hiển thị ─────────────────────────────────────────────────────
  projects: ProjectInfo[] = [];
  filteredProjects: ProjectInfo[] = [];
  selectedProject: ProjectInfo | null = null;
  projectTree: ProjectMember[] = [];

  // ── Tìm kiếm / lọc ───────────────────────────────────────────────────────
  searchQuery     = '';
  memberSearch    = '';
  memberDeptFilter = 'all';
  memberSortCol: string = 'name';
  memberSortDir: 'asc' | 'desc' = 'asc';
  statusFilter    = 'all';
  sortProjectBy: 'name' | 'memberCount' = 'name';
  sortProjectDir: 'asc' | 'desc' = 'asc';
  statusPopoverOpen = false;

  // ── Chế độ xem ───────────────────────────────────────────────────────────
  viewMode: 'tree' | 'table' = 'tree';
  expandedNodes = new Set<string>();

  // ── Phân trang bảng ──────────────────────────────────────────────────────
  tablePage = 0;
  readonly tablePageSize = 10;

  // ── Panel CRUD ────────────────────────────────────────────────────────────
  panelMode: PanelMode = 'closed';
  projectForm = { name: '', status: 'active', description: '' };
  memberForm  = { employeeId: '', role: '', startDate: '', endDate: '' };
  editingAssignmentId: string | null = null;
  editingMemberEmployee: Employee | null = null;
  // Used in template – not private
  _pendingProjectName = '';
  _pendingProjectDescription = '';
  _autoSelectProjectName: string | null = null;

  // ── Meta dự án (localStorage: mô tả + tiến độ) ───────────────────────────
  private readonly PROJ_META_KEY = 'eflow_proj_meta';
  private projectMeta: Record<string, { description?: string; progress?: number }> = {};

  // ── Xác nhận xoá ─────────────────────────────────────────────────────────
  deleteProjectConfirm               = false;
  deleteMemberConfirm: string | null = null;

  // ── Trạng thái loading ────────────────────────────────────────────────────
  isSaving   = false;
  isDeleting = false;
  formErrors: Record<string, string> = {};

  // ── Tab điều hướng (Thành viên / Tài chính / Tiến độ) ────────────────────
  detailTab: 'members' | 'finance' | 'progress' = 'members';

  // ── Thông tin tài chính dự án ─────────────────────────────────────────────
  projectInfo: ProjectInfoApiDTO | null = null;
  isLoadingFinance = false;
  isEditingInfo    = false;
  infoForm: Partial<ProjectInfoApiDTO> = {};
  isSavingInfo  = false;
  infoFormErrors: Record<string, string> = {};

  // ── Mốc hóa đơn ──────────────────────────────────────────────────────────
  milestones: InvoiceMilestoneApiDTO[] = [];
  milestoneFormVisible  = false;
  editingMilestoneId: number | null = null;
  milestoneForm: Partial<InvoiceMilestoneApiDTO> = {};
  isSavingMilestone  = false;
  deletingMilestoneId: number | null = null;

  // ── Giai đoạn / Tiến độ ──────────────────────────────────────────────────
  phases: ProjectPhaseApiDTO[] = [];
  isLoadingPhases   = false;
  phaseFormVisible  = false;
  phaseView: 'card' | 'gantt' = 'card';
  editingPhaseId: number | null = null;
  phaseForm: Partial<ProjectPhaseApiDTO> = {};
  isSavingPhase  = false;
  deletingPhaseId: number | null = null;

  readonly milestoneStatusOptions = [
    { value: 'pending',  label: 'Chờ xuất' },
    { value: 'invoiced', label: 'Đã xuất HĐ' },
    { value: 'paid',     label: 'Đã thanh toán' }
  ];

  readonly phaseStatusOptions = [
    { value: 'on_track',  label: 'Đúng kế hoạch' },
    { value: 'at_risk',   label: 'Có rủi ro' },
    { value: 'delayed',   label: 'Trễ tiến độ' },
    { value: 'completed', label: 'Hoàn thành' }
  ];

  readonly milestoneStatusLabel: Record<string, string> = {
    pending: 'Chờ xuất', invoiced: 'Đã xuất HĐ', paid: 'Đã thanh toán'
  };

  readonly phaseStatusLabel: Record<string, string> = {
    on_track: 'Đúng kế hoạch', at_risk: 'Có rủi ro', delayed: 'Trễ tiến độ', completed: 'Hoàn thành'
  };

  readonly statusOptions = [
    { val: 'active',    label: 'Đang thực hiện' },
    { val: 'pending',   label: 'Chờ triển khai'  },
    { val: 'completed', label: 'Hoàn thành'       }
  ];

  readonly statusSelectOptions = [
    { value: 'active',    label: 'Đang thực hiện' },
    { value: 'pending',   label: 'Chờ triển khai'  },
    { value: 'completed', label: 'Hoàn thành'       }
  ];

  // ── Clone dự án ────────────────────────────────────────────────
  clonePanelOpen    = false;
  cloneName         = '';
  cloneNameError    = '';
  isCloning         = false;
  _cloneSourceProject: ProjectInfo | null = null;

  // ── Export ──────────────────────────────────────────────────────
  isExportingMembers = false;

  constructor(
    private eflowApi: EFlowApiService,
    private excelService: ExcelImportService,
    private exportService: ExportService
  ) {
    try {
      const raw = localStorage.getItem(this.PROJ_META_KEY);
      this.projectMeta = raw ? JSON.parse(raw) : {};
    } catch { this.projectMeta = {}; }
  }

  get availableEmployees(): Employee[] {
    const memberIds = new Set((this.selectedProject?.members ?? []).map(m => m.employee.id));
    return this.allEmployees.filter(e => !memberIds.has(e.id));
  }

  get availableEmployeeOptions() {
    return this.availableEmployees.map(e => {
      const active   = (e.projects ?? []).filter(p => p.status === 'active').length;
      const overLabel = active > 3 ? ` ⚠️ ${active} active` : active > 0 ? ` (${active} active)` : '';
      return { value: e.id, label: `${e.name} – ${e.position ?? ''}${overLabel}` };
    });
  }

  get selectedMemberIsOverloaded(): boolean {
    if (!this.memberForm.employeeId) return false;
    const emp = this.allEmployees.find(e => e.id === this.memberForm.employeeId);
    return emp ? (emp.projects ?? []).filter(p => p.status === 'active').length > 3 : false;
  }

  get selectedMemberActiveCount(): number {
    if (!this.memberForm.employeeId) return 0;
    const emp = this.allEmployees.find(e => e.id === this.memberForm.employeeId);
    return emp ? (emp.projects ?? []).filter(p => p.status === 'active').length : 0;
  }

  get totalTablePages(): number {
    return Math.max(1, Math.ceil(this.flatFilteredMembers.length / this.tablePageSize));
  }

  get pagedMembers(): ProjectMember[] {
    const start = this.tablePage * this.tablePageSize;
    return this.flatFilteredMembers.slice(start, start + this.tablePageSize);
  }

  get tablePageNumbers(): number[] {
    const total = this.totalTablePages;
    const cur = this.tablePage;
    let start = Math.max(0, cur - 2);
    let end = Math.min(total - 1, start + 4);
    start = Math.max(0, end - 4);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  tableGoTo(page: number): void {
    if (page >= 0 && page < this.totalTablePages) this.tablePage = page;
  }

  get tableEndIndex(): number {
    return Math.min((this.tablePage + 1) * this.tablePageSize, this.flatFilteredMembers.length);
  }

  zoomLevel = 0.7;
  readonly MIN_ZOOM = 0.3;
  readonly MAX_ZOOM = 2.0;

  get zoomPercent(): number { return Math.round(this.zoomLevel * 100); }

  zoomIn(): void  { this.zoomLevel = Math.min(this.MAX_ZOOM, +(this.zoomLevel + 0.1).toFixed(2)); }
  zoomOut(): void { this.zoomLevel = Math.max(this.MIN_ZOOM, +(this.zoomLevel - 0.1).toFixed(2)); }
  resetZoom(): void { this.zoomLevel = 0.7; setTimeout(() => this.scrollToCenter(), 50); }

  // Pan state
  isPanning = false;
  hasDragged = false;
  private panStartX = 0;
  private panStartY = 0;
  private panScrollLeft = 0;
  private panScrollTop = 0;

  onPanStart(event: MouseEvent): void {
    if (event.button === 0 || event.button === 1) {
      this.isPanning = true;
      this.hasDragged = false;
      const el = this.treeWrapperRef?.nativeElement;
      if (!el) return;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      this.panScrollLeft = el.scrollLeft;
      this.panScrollTop = el.scrollTop;
    }
  }

  onPanMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    if (!this.hasDragged && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      this.hasDragged = true;
    }
    if (this.hasDragged) {
      event.preventDefault();
      const el = this.treeWrapperRef?.nativeElement;
      if (!el) return;
      el.scrollLeft = this.panScrollLeft - dx;
      el.scrollTop  = this.panScrollTop  - dy;
    }
  }

  onPanEnd(): void {
    this.isPanning = false;
    setTimeout(() => { this.hasDragged = false; }, 0);
  }

  onWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      this.zoomLevel = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, +(this.zoomLevel + delta).toFixed(2)));
    }
  }

  scrollToCenter(): void {
    const el = this.treeWrapperRef?.nativeElement;
    if (el) el.scrollTo({ top: 0, left: (el.scrollWidth - el.clientWidth) / 2, behavior: 'smooth' });
  }

  private lastPinchDist = 0;
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    } else { this.lastPinchDist = 0; }
  }
  onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && this.lastPinchDist > 0) {
      event.preventDefault();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = (dist - this.lastPinchDist) * 0.006;
      this.zoomLevel = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, +(this.zoomLevel + delta).toFixed(2)));
      this.lastPinchDist = dist;
    }
  }
  onTouchEnd(): void { this.lastPinchDist = 0; }

  readonly statusLabel: Record<string, string> = {
    active: 'Đang thực hiện',
    completed: 'Hoàn thành',
    pending: 'Chờ triển khai'
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['autoSelectProject'] && this.autoSelectProject) {
      this._autoSelectProjectName = this.autoSelectProject;
    }
    if (changes['allEmployees']) {
      this.buildProjects();
    }
  }

  private buildProjects(): void {
    const map = new Map<string, ProjectInfo>();

    for (const emp of this.allEmployees) {
      for (const proj of (emp.projects ?? [])) {
        const key = proj.name?.trim();
        if (!key) continue;

        if (!map.has(key)) {
          map.set(key, { id: key, name: key, status: proj.status as any, memberCount: 0, members: [] });
        }
        const info = map.get(key)!;
        info.memberCount++;
        // Trạng thái dự án là độc lập, không dọn ra từ từng thành viên

        info.members.push({
          assignmentId: proj.id,
          employee:     emp,
          role:         proj.role,
          startDate:    proj.startDate,
          endDate:      proj.endDate,
          status:       proj.status as any,
          children:     []
        });
      }
    }

    this.projects = Array.from(map.values()).sort((a, b) => {
      const ord: Record<string, number> = { active: 0, pending: 1, completed: 2 };
      return (ord[a.status] ?? 3) - (ord[b.status] ?? 3) || a.name.localeCompare(b.name, 'vi');
    });

    this.applyProjectFilter();

    // Auto-select a project after creation
    if (this._autoSelectProjectName) {
      const toSelect = this.projects.find(
        p => p.name.toLowerCase() === this._autoSelectProjectName!.toLowerCase()
      );
      this._autoSelectProjectName = null;
      if (toSelect) {
        this.selectProject(toSelect);
        return;
      }
    }

    if (this.selectedProject) {
      const updated = this.projects.find(p => p.id === this.selectedProject!.id);
      if (updated) {
        this.selectedProject = updated;
        this.projectTree = this.buildMemberTree(updated.members);
      } else {
        this.selectedProject = null;
        this.projectTree = [];
      }
    }
  }

  applyProjectFilter(): void {
    const q = this.searchQuery.toLowerCase();
    const filtered = this.projects.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      const matchStatus = this.statusFilter === 'all' || p.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
    filtered.sort((a, b) => {
      const cmp = this.sortProjectBy === 'memberCount'
        ? a.memberCount - b.memberCount
        : a.name.localeCompare(b.name, 'vi');
      return this.sortProjectDir === 'asc' ? cmp : -cmp;
    });
    this.filteredProjects = filtered;
  }

  setSort(col: 'name' | 'memberCount'): void {
    if (this.sortProjectBy === col) {
      this.sortProjectDir = this.sortProjectDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortProjectBy  = col;
      this.sortProjectDir = 'asc';
    }
    this.applyProjectFilter();
  }

  selectProject(proj: ProjectInfo | null): void {
    this.selectedProject      = proj;
    this.memberSearch         = '';
    this.memberDeptFilter     = 'all';
    this.memberSortCol        = 'name';
    this.memberSortDir        = 'asc';
    this.statusPopoverOpen    = false;
    this.tablePage            = 0;
    this.viewMode             = 'tree';
    this.panelMode            = 'closed';
    this.deleteProjectConfirm = false;
    this.deleteMemberConfirm  = null;
    this.expandedNodes        = new Set();
    // Reset tab + finance data
    this.detailTab          = 'members';
    this.projectInfo        = null;
    this.milestones         = [];
    this.phases             = [];
    this.milestoneFormVisible = false;
    this.phaseFormVisible     = false;
    if (proj) {
      this.projectTree = this.buildMemberTree(proj.members);
      this.expandAllNodes(this.projectTree);
      setTimeout(() => { this.zoomLevel = 0.7; this.scrollToCenter(); }, 300);
    } else {
      this.projectTree = [];
    }
  }

  switchTab(tab: 'members' | 'finance' | 'progress'): void {
    this.detailTab = tab;
    const name = this.selectedProject?.name;
    if (!name) return;
    if (tab === 'finance' && !this.projectInfo && !this.isLoadingFinance) {
      this.loadFinanceData(name);
    }
    if (tab === 'progress' && !this.phases.length && !this.isLoadingPhases) {
      this.loadPhases(name);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TAI CHINH - PROJECT INFO
  // ══════════════════════════════════════════════════════════════════════════

  private loadFinanceData(projectName: string): void {
    this.isLoadingFinance = true;
    this.eflowApi.getProjectInfo(projectName).subscribe({
      next: (data) => { this.projectInfo = data; this.isLoadingFinance = false; },
      error: (err) => {
        // 404 = chưa tạo info → không phải lỗi
        this.projectInfo = null;
        this.isLoadingFinance = false;
        // Load milestones dù info có hay không
        this.eflowApi.getMilestones(projectName).subscribe({
          next: (list) => { this.milestones = list; },
          error: () => { this.milestones = []; }
        });
      }
    });
    this.eflowApi.getMilestones(projectName).subscribe({
      next: (list) => { this.milestones = list; },
      error: () => { this.milestones = []; }
    });
  }

  openEditInfo(): void {
    const name = this.selectedProject?.name ?? '';
    this.infoForm = this.projectInfo
      ? { ...this.projectInfo }
      : { projectName: name, contractValue: undefined, plannedCost: undefined, actualCost: undefined };
    this.infoFormErrors = {};
    this.isEditingInfo  = true;
  }

  cancelEditInfo(): void { this.isEditingInfo = false; }

  saveInfo(): void {
    this.infoFormErrors = {};
    const name = this.selectedProject?.name;
    if (!name) return;
    if (!this.infoForm.projectName?.trim()) {
      this.infoFormErrors['projectName'] = 'Tên dự án không được để trống';
      return;
    }
    this.isSavingInfo = true;
    const dto: ProjectInfoApiDTO = {
      ...(this.projectInfo ?? {}),
      ...this.infoForm,
      projectName: name
    } as ProjectInfoApiDTO;

    const op$ = this.projectInfo
      ? this.eflowApi.updateProjectInfo(name, dto)
      : this.eflowApi.createProjectInfo(dto);

    op$.subscribe({
      next: (saved) => {
        this.projectInfo  = saved;
        this.isSavingInfo = false;
        this.isEditingInfo = false;
      },
      error: (err: any) => {
        this.isSavingInfo = false;
        this.infoFormErrors['general'] = err?.error?.message ?? 'Lỗi khi lưu';
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MILESTONES
  // ══════════════════════════════════════════════════════════════════════════

  openAddMilestone(): void {
    this.editingMilestoneId  = null;
    this.milestoneForm = {
      projectName: this.selectedProject?.name ?? '',
      name: '', status: 'pending', sortOrder: this.milestones.length
    };
    this.milestoneFormVisible = true;
  }

  openEditMilestone(m: InvoiceMilestoneApiDTO): void {
    this.editingMilestoneId = m.id ?? null;
    this.milestoneForm = { ...m };
    this.milestoneFormVisible = true;
  }

  cancelMilestoneForm(): void { this.milestoneFormVisible = false; }

  saveMilestone(): void {
    if (!this.milestoneForm.name?.trim()) return;
    this.isSavingMilestone = true;
    const dto = this.milestoneForm as InvoiceMilestoneApiDTO;
    const op$ = this.editingMilestoneId
      ? this.eflowApi.updateMilestone(this.editingMilestoneId, dto)
      : this.eflowApi.createMilestone(dto);
    op$.subscribe({
      next: () => {
        this.isSavingMilestone    = false;
        this.milestoneFormVisible = false;
        const name = this.selectedProject?.name;
        if (name) this.eflowApi.getMilestones(name).subscribe({ next: (l) => { this.milestones = l; this.loadFinanceData(name); } });
      },
      error: (err: any) => {
        this.isSavingMilestone = false;
        console.error('[eFlow] saveMilestone', err);
      }
    });
  }

  confirmDeleteMilestone(id: number): void { this.deletingMilestoneId = id; }
  cancelDeleteMilestone(): void { this.deletingMilestoneId = null; }

  doDeleteMilestone(id: number): void {
    this.eflowApi.deleteMilestone(id).subscribe({
      next: () => {
        this.deletingMilestoneId = null;
        const name = this.selectedProject?.name;
        if (name) this.eflowApi.getMilestones(name).subscribe({ next: (l) => { this.milestones = l; this.loadFinanceData(name); } });
      },
      error: () => { this.deletingMilestoneId = null; }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PHASES
  // ══════════════════════════════════════════════════════════════════════════

  private loadPhases(projectName: string): void {
    this.isLoadingPhases = true;
    this.eflowApi.getPhases(projectName).subscribe({
      next: (list) => {
        this.phases = list;
        this.isLoadingPhases = false;
        this._cachePhaseProgress(projectName, list);
      },
      error: () => { this.phases = []; this.isLoadingPhases = false; }
    });
  }

  openAddPhase(): void {
    this.editingPhaseId = null;
    this.phaseForm = {
      projectName: this.selectedProject?.name ?? '',
      name: '', progress: 0, status: 'on_track', sortOrder: this.phases.length
    };
    this.phaseFormVisible = true;
  }

  openEditPhase(p: ProjectPhaseApiDTO): void {
    this.editingPhaseId = p.id ?? null;
    this.phaseForm = { ...p };
    this.phaseFormVisible = true;
  }

  cancelPhaseForm(): void { this.phaseFormVisible = false; }

  savePhase(): void {
    if (!this.phaseForm.name?.trim()) return;
    this.isSavingPhase = true;
    const dto = this.phaseForm as ProjectPhaseApiDTO;
    const op$ = this.editingPhaseId
      ? this.eflowApi.updatePhase(this.editingPhaseId, dto)
      : this.eflowApi.createPhase(dto);
    op$.subscribe({
      next: () => {
        this.isSavingPhase    = false;
        this.phaseFormVisible = false;
        const name = this.selectedProject?.name;
        if (name) this.eflowApi.getPhases(name).subscribe({
          next: (l) => { this.phases = l; this._cachePhaseProgress(name, l); }
        });
      },
      error: (err: any) => { this.isSavingPhase = false; console.error('[eFlow] savePhase', err); }
    });
  }

  confirmDeletePhase(id: number): void { this.deletingPhaseId = id; }
  cancelDeletePhase(): void { this.deletingPhaseId = null; }

  doDeletePhase(id: number): void {
    this.eflowApi.deletePhase(id).subscribe({
      next: () => {
        this.deletingPhaseId = null;
        const name = this.selectedProject?.name;
        if (name) this.eflowApi.getPhases(name).subscribe({
          next: (l) => { this.phases = l; this._cachePhaseProgress(name, l); }
        });
      },
      error: () => { this.deletingPhaseId = null; }
    });
  }

  formatVnd(value?: number): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  /** Hiển thị số tiền dạng 1.000.000.000 trong ô input */
  toVndStr(v: number | undefined | null): string {
    if (v == null) return '';
    return Math.round(v).toLocaleString('de-DE');
  }

  /** Xử lý sự kiện input tiền: chỉ cho nhập số, tự động format dấu chấm ngăn cách */
  onVndInput(event: Event, obj: Record<string, any>, key: string): void {
    const input = event.target as HTMLInputElement;
    const selStart = input.selectionStart ?? 0;
    const dotsBefore = (input.value.slice(0, selStart).match(/\./g) ?? []).length;

    const digits = input.value.replace(/[^\d]/g, '');
    const num = digits ? parseInt(digits, 10) : undefined;
    obj[key] = num;

    const formatted = num != null ? Math.round(num).toLocaleString('de-DE') : '';
    input.value = formatted;

    const dotsAfter = (formatted.slice(0, selStart).match(/\./g) ?? []).length;
    const newPos = Math.max(0, selStart + (dotsAfter - dotsBefore));
    input.setSelectionRange(newPos, newPos);
  }

  getPhaseStatusClass(status: string): string {
    return `phase-${status.replace('_', '-')}`;
  }

  getMilestoneStatusClass(status: string): string {
    return `ms-${status}`;
  }

  overallProgress(): number {
    if (!this.phases.length) return 0;
    return Math.round(this.phases.reduce((s, p) => s + p.progress, 0) / this.phases.length);
  }

  /** Compute Gantt bar positions (left% + width%) for each phase */
  ganttBars(): { phase: ProjectPhaseApiDTO; left: number; width: number; tooNarrow: boolean }[] {
    const dated = this.phases.filter(p => p.plannedStart && p.plannedEnd);
    if (!dated.length) return [];

    const toMs = (s: string) => new Date(s).getTime();
    const minMs = Math.min(...dated.map(p => toMs(p.plannedStart!)));
    const maxMs = Math.max(...dated.map(p => toMs(p.plannedEnd!)));
    const span  = maxMs - minMs || 1;

    return this.phases.map(p => {
      if (!p.plannedStart || !p.plannedEnd) return { phase: p, left: 0, width: 0, tooNarrow: false };
      const left  = ((toMs(p.plannedStart) - minMs) / span) * 100;
      const width = Math.max(2, ((toMs(p.plannedEnd) - toMs(p.plannedStart)) / span) * 100);
      return { phase: p, left, width, tooNarrow: width < 8 };
    });
  }

  /** Gantt x-axis labels (start / mid / end) */
  ganttAxisDates(): string[] {
    const dated = this.phases.filter(p => p.plannedStart && p.plannedEnd);
    if (!dated.length) return [];
    const toMs  = (s: string) => new Date(s).getTime();
    const minMs = Math.min(...dated.map(p => toMs(p.plannedStart!)));
    const maxMs = Math.max(...dated.map(p => toMs(p.plannedEnd!)));
    const fmt   = (ms: number) => new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return [fmt(minMs), fmt((minMs + maxMs) / 2), fmt(maxMs)];
  }

  private expandAllNodes(members: ProjectMember[]): void {
    members.forEach(m => {
      this.expandedNodes.add(m.employee.id);
      if (m.children.length) this.expandAllNodes(m.children);
    });
  }

  isNodeExpanded(member: ProjectMember): boolean {
    return this.expandedNodes.has(member.employee.id);
  }

  toggleNode(member: ProjectMember, event: Event): void {
    event.stopPropagation();
    if (this.expandedNodes.has(member.employee.id)) {
      this.expandedNodes.delete(member.employee.id);
    } else {
      this.expandedNodes.add(member.employee.id);
    }
    this.expandedNodes = new Set(this.expandedNodes);
  }

  private buildMemberTree(members: ProjectMember[]): ProjectMember[] {
    const memberIds = new Set(members.map(m => m.employee.id));
    const roots: ProjectMember[] = [];
    const nodeMap = new Map<string, ProjectMember>();

    members.forEach(m => nodeMap.set(m.employee.id, { ...m, children: [] }));

    nodeMap.forEach(node => {
      const mgr = node.employee.managerId;
      if (mgr && memberIds.has(mgr) && nodeMap.has(mgr)) {
        nodeMap.get(mgr)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort each level by employee level then name
    const sortNodes = (nodes: ProjectMember[]): ProjectMember[] =>
      nodes
        .sort((a, b) => a.employee.level - b.employee.level || a.employee.name.localeCompare(b.employee.name, 'vi'))
        .map(n => ({ ...n, children: sortNodes(n.children) }));

    return sortNodes(roots);
  }

  get filteredProjectTree(): ProjectMember[] {
    if (!this.memberSearch) return this.projectTree;
    const q = this.memberSearch.toLowerCase();
    const filterTree = (nodes: ProjectMember[]): ProjectMember[] =>
      nodes.reduce((acc, node) => {
        const match =
          node.employee.name.toLowerCase().includes(q) ||
          node.employee.position?.toLowerCase().includes(q) ||
          node.role?.toLowerCase().includes(q);
        const children = filterTree(node.children);
        if (match || children.length) {
          acc.push({ ...node, children });
        }
        return acc;
      }, [] as ProjectMember[]);
    return filterTree(this.projectTree);
  }

  get flatFilteredMembers(): ProjectMember[] {
    const all = this.selectedProject?.members ?? [];
    const q = this.memberSearch.toLowerCase();
    return all
      .filter(m => {
        const matchSearch = !q ||
          m.employee.name.toLowerCase().includes(q) ||
          m.employee.position?.toLowerCase().includes(q) ||
          m.employee.department?.toLowerCase().includes(q) ||
          m.role?.toLowerCase().includes(q);
        const matchDept = this.memberDeptFilter === 'all' || m.employee.department === this.memberDeptFilter;
        return matchSearch && matchDept;
      })
      .sort((a, b) => {
        let va: any, vb: any;
        switch (this.memberSortCol) {
          case 'name':      va = a.employee.name;       vb = b.employee.name;       break;
          case 'position':  va = a.employee.position;   vb = b.employee.position;   break;
          case 'dept':      va = a.employee.department; vb = b.employee.department; break;
          case 'role':      va = a.role;                vb = b.role;                break;
          case 'startDate': va = a.startDate ?? '';     vb = b.startDate ?? '';     break;
          case 'endDate':   va = a.endDate ?? '';       vb = b.endDate ?? '';       break;
          default:          va = a.employee.name;       vb = b.employee.name;
        }
        const cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'vi');
        return this.memberSortDir === 'asc' ? cmp : -cmp;
      });
  }

  onMemberSearchChange(): void {
    this.tablePage = 0;
  }

  get memberDeptOptions(): { value: string; label: string }[] {
    const depts = new Set(
      (this.selectedProject?.members ?? [])
        .map(m => m.employee.department)
        .filter((d): d is string => !!d)
    );
    const sorted = Array.from(depts).sort((a, b) => a.localeCompare(b, 'vi'));
    return [
      { value: 'all', label: 'Tất cả phòng ban' },
      ...sorted.map(d => ({ value: d, label: d }))
    ];
  }

  sortMember(col: string): void {
    if (this.memberSortCol === col) this.memberSortDir = this.memberSortDir === 'asc' ? 'desc' : 'asc';
    else { this.memberSortCol = col; this.memberSortDir = 'asc'; }
    this.tablePage = 0;
  }

  quickChangeStatus(status: string): void {
    if (!this.selectedProject || this.selectedProject.status === status) {
      this.statusPopoverOpen = false;
      return;
    }
    this.statusPopoverOpen = false;
    this.eflowApi.updateProjectStatus(this.selectedProject.name, status).subscribe({
      next: () => this.refreshData(),
      error: (err: any) => console.error('[eFlow] quickChangeStatus failed', err)
    });
  }

  countAllMembers(nodes: ProjectMember[]): number {
    return nodes.reduce((sum, n) => sum + 1 + this.countAllMembers(n.children), 0);
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  parseDateStr(val: string): Date | null {
    if (!val) return null;
    const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    const ymd = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
    return null;
  }

  isDeadlineOver(dateStr?: string): boolean {
    if (!dateStr) return false;
    const d = this.parseDateStr(dateStr);
    return d ? d < new Date() : false;
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

  getPanelTitle(): string {
    switch (this.panelMode) {
      case 'create-project': return 'Tạo dự án mới';
      case 'edit-project':   return 'Đổi tên dự án';
      case 'add-member':     return this._pendingProjectName
        ? `Thêm thành viên vào "${this._pendingProjectName}"`
        : `Thêm thành viên vào "${this.selectedProject?.name}"`;
      case 'edit-member':    return 'Sửa thông tin thành viên';
      default: return '';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CRUD - DỰ ÁN
  // ══════════════════════════════════════════════════════════════════════════

  openCreateProject(event?: Event): void {
    event?.stopPropagation();
    this.projectForm = { name: '', status: 'active', description: '' };
    this.formErrors  = {};
    this.deleteProjectConfirm = false;
    this.deleteMemberConfirm  = null;
    this.panelMode = 'create-project';
  }

  openEditProject(proj: ProjectInfo, event?: Event): void {
    event?.stopPropagation();
    this.selectProject(proj);
    this.projectForm = {
      name: proj.name,
      status: proj.status,
      description: this.projectMeta[proj.name]?.description ?? ''
    };
    this.formErrors  = {};
    this.panelMode = 'edit-project';
  }

  saveProject(): void {
    this.formErrors = {};
    const name = this.projectForm.name.trim();
    if (!name) { this.formErrors['name'] = 'Tên dự án không được để trống'; return; }

    if (this.panelMode === 'create-project') {
      if (this.projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        this.formErrors['name'] = 'Tên dự án đã tồn tại';
        return;
      }
      this._pendingProjectName        = name;
      this._pendingProjectDescription = this.projectForm.description.trim();
      this.memberForm = { employeeId: '', role: '', startDate: '', endDate: '' };
      this.editingAssignmentId    = null;
      this.editingMemberEmployee  = null;
      this.panelMode = 'add-member';
      return;
    }

    if (!this.selectedProject) return;
    const oldName   = this.selectedProject.name;
    const oldStatus = this.selectedProject.status;
    const nameChanged   = name !== oldName;
    const statusChanged = this.projectForm.status !== oldStatus;

    // Save description locally (localStorage) regardless of API
    const desc = this.projectForm.description.trim();
    if (!this.projectMeta[name]) this.projectMeta[name] = {};
    this.projectMeta[name].description = desc;
    // Migrate key if name is changing
    if (nameChanged && this.projectMeta[oldName]) {
      this.projectMeta[name] = { ...this.projectMeta[oldName], description: desc };
      delete this.projectMeta[oldName];
    }
    try { localStorage.setItem(this.PROJ_META_KEY, JSON.stringify(this.projectMeta)); } catch {}

    if (!nameChanged && !statusChanged) { this.closePanel(); return; }

    this.isSaving = true;

    const doStatusUpdate = (currentName: string): void => {
      if (!statusChanged) {
        this.isSaving = false; this.closePanel(); this.refreshData(); return;
      }
      this.eflowApi.updateProjectStatus(currentName, this.projectForm.status).subscribe({
        next: () => { this.isSaving = false; this.closePanel(); this.refreshData(); },
        error: (err: any) => { this.isSaving = false; this.formErrors['status'] = err?.error?.message ?? 'Lỗi cập nhật trạng thái'; }
      });
    };

    if (nameChanged) {
      this.eflowApi.renameProject(oldName, name).subscribe({
        next: () => doStatusUpdate(name),
        error: (err: any) => { this.isSaving = false; this.formErrors['name'] = err?.error?.message ?? 'Lỗi khi đổi tên dự án'; }
      });
    } else {
      doStatusUpdate(oldName);
    }
  }

  confirmDeleteProject(proj?: ProjectInfo, event?: Event): void {
    event?.stopPropagation();
    if (proj) this.selectProject(proj);
    this.deleteProjectConfirm = true;
    this.panelMode = 'closed';
  }

  doDeleteProject(): void {
    if (!this.selectedProject || this.isDeleting) return;
    this.isDeleting = true;
    this.eflowApi.deleteProjectByName(this.selectedProject.name).subscribe({
      next: () => {
        this.isDeleting = false;
        this.deleteProjectConfirm = false;
        this.selectProject(null);
        this.refreshData();
      },
      error: (err: any) => { this.isDeleting = false; console.error('[eFlow] Delete project', err); }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CRUD - THÀNH VIÊN
  // ══════════════════════════════════════════════════════════════════════════

  openAddMember(event?: Event): void {
    event?.stopPropagation();
    this._pendingProjectName   = this.selectedProject?.name ?? '';
    this.editingAssignmentId   = null;
    this.editingMemberEmployee = null;
    this.memberForm = { employeeId: '', role: '', startDate: '', endDate: '' };
    this.formErrors = {};
    this.panelMode  = 'add-member';
  }

  openEditMember(member: ProjectMember, event?: Event): void {
    event?.stopPropagation();
    this.editingAssignmentId   = member.assignmentId;
    this.editingMemberEmployee = member.employee;
    this._pendingProjectName   = this.selectedProject?.name ?? '';
    this.memberForm = {
      employeeId: member.employee.id,
      role:       member.role ?? '',
      startDate:  member.startDate ?? '',
      endDate:    member.endDate   ?? ''
    };
    this.formErrors = {};
    this.panelMode  = 'edit-member';
  }

  saveMember(): void {
    this.formErrors = {};
    if (this.panelMode === 'add-member' && !this.memberForm.employeeId) {
      this.formErrors['employeeId'] = 'Vui lòng chọn nhân viên'; return;
    }
    if (!this.memberForm.role.trim()) {
      this.formErrors['role'] = 'Vai trò không được để trống'; return;
    }
    const projectName = this._pendingProjectName || this.selectedProject?.name;
    if (!projectName) { this.formErrors['general'] = 'Không xác định được dự án'; return; }

    const dto: ProjectApiDTO = {
      id:         this.editingAssignmentId ?? '',
      employeeId: this.memberForm.employeeId,
      name:       projectName,
      role:       this.memberForm.role.trim(),
      startDate:  this.memberForm.startDate || undefined,
      endDate:    this.memberForm.endDate   || undefined,
      status:     (this.selectedProject?.status ?? this.projectForm.status ?? 'active') as any
    };

    // If adding first member to a brand-new project, remember name for auto-select
    const autoSelect = (this.panelMode === 'add-member' && !this.selectedProject)
      ? this._pendingProjectName : null;

    this.isSaving = true;
    const op$ = this.panelMode === 'add-member'
      ? this.eflowApi.createProject(dto)
      : this.eflowApi.updateProject(this.editingAssignmentId!, dto);

    op$.subscribe({
      next: () => {
        this.isSaving = false;
        this.closePanel();
        if (autoSelect) {
          this._autoSelectProjectName = autoSelect;
          if (this._pendingProjectDescription) {
            if (!this.projectMeta[autoSelect]) this.projectMeta[autoSelect] = {};
            this.projectMeta[autoSelect].description = this._pendingProjectDescription;
            try { localStorage.setItem(this.PROJ_META_KEY, JSON.stringify(this.projectMeta)); } catch {}
            this._pendingProjectDescription = '';
          }
        }
        this.refreshData();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.formErrors['general'] = err?.error?.message ?? 'Lỗi khi lưu thành viên';
      }
    });
  }

  confirmDeleteMember(assignmentId: string, event?: Event): void {
    event?.stopPropagation();
    this.deleteMemberConfirm = assignmentId;
  }

  doDeleteMember(assignmentId: string): void {
    if (this.isDeleting) return;
    this.isDeleting = true;
    this.eflowApi.deleteProject(assignmentId).subscribe({
      next: () => { this.isDeleting = false; this.deleteMemberConfirm = null; this.refreshData(); },
      error: () => { this.isDeleting = false; this.deleteMemberConfirm = null; }
    });
  }

  cancelDeleteMember(): void { this.deleteMemberConfirm = null; }

  closePanel(): void {
    this.panelMode             = 'closed';
    this.formErrors            = {};
    this.editingAssignmentId   = null;
    this.editingMemberEmployee = null;
    this._pendingProjectName   = '';
  }

  getProjectDescription(name: string): string {
    return this.projectMeta[name]?.description ?? '';
  }

  getProjectProgress(name: string): number | null {
    const v = this.projectMeta[name]?.progress;
    return v != null ? v : null;
  }

  private _cachePhaseProgress(projectName: string, phases: ProjectPhaseApiDTO[]): void {
    if (!phases.length) return;
    const avg = phases.reduce((s, p) => s + (p.progress ?? 0), 0) / phases.length;
    if (!this.projectMeta[projectName]) this.projectMeta[projectName] = {};
    this.projectMeta[projectName].progress = Math.round(avg);
    try { localStorage.setItem(this.PROJ_META_KEY, JSON.stringify(this.projectMeta)); } catch {}
  }

  private refreshData(): void {
    this.excelService.loadFromApi().subscribe({
      next: (result) => {
        // Cập nhật trực tiếp không chờ @Input từ AppComponent
        this.allEmployees = result.employees;
        this.buildProjects();
      },
      error: (err: any) => console.warn('[eFlow] Refresh failed:', err)
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ══════════════════════════════════════════════════════════════════════════

  exportMembers(): void {
    if (!this.selectedProject || this.isExportingMembers) return;
    this.isExportingMembers = true;
    try {
      this.exportService.exportProjectMembers(this.selectedProject, this.selectedProject.members);
    } finally {
      this.isExportingMembers = false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CLONE PROJECT (PM-G10)
  // ══════════════════════════════════════════════════════════════════════════

  openCloneProject(proj: ProjectInfo, event?: Event): void {
    event?.stopPropagation();
    this._cloneSourceProject = proj;
    this.cloneName        = proj.name + ' (Copy)';
    this.cloneNameError   = '';
    this.clonePanelOpen   = true;
  }

  cancelClone(): void {
    this.clonePanelOpen       = false;
    this._cloneSourceProject  = null;
    this.cloneName            = '';
    this.cloneNameError       = '';
  }

  doCloneProject(): void {
    const newName = this.cloneName.trim();
    if (!newName) { this.cloneNameError = 'Tên dự án không được để trống'; return; }
    if (this.projects.some(p => p.name.toLowerCase() === newName.toLowerCase())) {
      this.cloneNameError = 'Tên dự án đã tồn tại'; return;
    }
    const src = this._cloneSourceProject;
    if (!src) return;

    this.isCloning = true;
    const members = src.members;
    if (!members.length) {
      // No members to clone — create a dummy call just to persist the project name
      this.isCloning = false;
      this.cancelClone();
      return;
    }

    let remaining = members.length;
    const done = () => {
      remaining--;
      if (remaining <= 0) {
        this.isCloning = false;
        this.cancelClone();
        this._autoSelectProjectName = newName;
        this.refreshData();
      }
    };

    members.forEach(m => {
      const dto: ProjectApiDTO = {
        id:         '',
        employeeId: m.employee.id,
        name:       newName,
        role:       m.role,
        startDate:  m.startDate,
        endDate:    m.endDate,
        status:     src.status as any
      };
      this.eflowApi.createProject(dto).subscribe({ next: done, error: done });
    });
  }
}
