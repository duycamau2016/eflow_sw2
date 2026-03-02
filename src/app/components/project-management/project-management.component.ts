import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { Employee } from '../../models/employee.model';
import { EFlowApiService, ProjectApiDTO } from '../../services/eflow-api.service';
import { ExcelImportService } from '../../services/excel-import.service';

export interface ProjectInfo {
  /** = project name – dùng làm key */
  id: string;
  name: string;
  status: 'active' | 'completed' | 'pending';
  memberCount: number;
  members: ProjectMember[];
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
  @ViewChild('treeWrapper') treeWrapperRef!: ElementRef<HTMLElement>;

  // ── Dữ liệu hiển thị ─────────────────────────────────────────────────────
  projects: ProjectInfo[] = [];
  filteredProjects: ProjectInfo[] = [];
  selectedProject: ProjectInfo | null = null;
  projectTree: ProjectMember[] = [];

  // ── Tìm kiếm / lọc ───────────────────────────────────────────────────────
  searchQuery  = '';
  memberSearch = '';
  statusFilter = 'all';

  // ── Chế độ xem ───────────────────────────────────────────────────────────
  viewMode: 'tree' | 'table' = 'tree';
  expandedNodes = new Set<string>();

  // ── Phân trang bảng ──────────────────────────────────────────────────────
  tablePage = 0;
  readonly tablePageSize = 10;

  // ── Panel CRUD ────────────────────────────────────────────────────────────
  panelMode: PanelMode = 'closed';
  projectForm = { name: '', status: 'active' };
  memberForm  = { employeeId: '', role: '', startDate: '', endDate: '' };
  editingAssignmentId: string | null = null;
  editingMemberEmployee: Employee | null = null;
  // Used in template – not private
  _pendingProjectName = '';
  _autoSelectProjectName: string | null = null;

  // ── Xác nhận xoá ─────────────────────────────────────────────────────────
  deleteProjectConfirm               = false;
  deleteMemberConfirm: string | null = null;

  // ── Trạng thái loading ────────────────────────────────────────────────────
  isSaving   = false;
  isDeleting = false;
  formErrors: Record<string, string> = {};

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

  constructor(
    private eflowApi: EFlowApiService,
    private excelService: ExcelImportService
  ) {}

  get availableEmployees(): Employee[] {
    const memberIds = new Set((this.selectedProject?.members ?? []).map(m => m.employee.id));
    return this.allEmployees.filter(e => !memberIds.has(e.id));
  }

  get availableEmployeeOptions() {
    return this.availableEmployees.map(e => ({
      value: e.id,
      label: `${e.name} – ${e.position ?? ''}`
    }));
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
    this.filteredProjects = this.projects.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      const matchStatus = this.statusFilter === 'all' || p.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  selectProject(proj: ProjectInfo | null): void {
    this.selectedProject      = proj;
    this.memberSearch         = '';
    this.tablePage            = 0;
    this.viewMode             = 'tree';
    this.panelMode            = 'closed';
    this.deleteProjectConfirm = false;
    this.deleteMemberConfirm  = null;
    this.expandedNodes        = new Set();
    if (proj) {
      this.projectTree = this.buildMemberTree(proj.members);
      this.expandAllNodes(this.projectTree);
      setTimeout(() => { this.zoomLevel = 0.7; this.scrollToCenter(); }, 300);
    } else {
      this.projectTree = [];
    }
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
    if (!this.memberSearch) return all;
    const q = this.memberSearch.toLowerCase();
    return all.filter(m =>
      m.employee.name.toLowerCase().includes(q) ||
      m.employee.position?.toLowerCase().includes(q) ||
      m.employee.department?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q)
    );
  }

  onMemberSearchChange(): void {
    this.tablePage = 0;
  }

  countAllMembers(nodes: ProjectMember[]): number {
    return nodes.reduce((sum, n) => sum + 1 + this.countAllMembers(n.children), 0);
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
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

  private toInputDate(value?: string): string {
    if (!value) return '';
    const p = value.split('/');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : value;
  }

  formatDisplayDate(value?: string): string {
    if (!value) return '—';
    const p = value.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : value;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CRUD - DỰ ÁN
  // ══════════════════════════════════════════════════════════════════════════

  openCreateProject(event?: Event): void {
    event?.stopPropagation();
    this.projectForm = { name: '', status: 'active' };
    this.formErrors  = {};
    this.deleteProjectConfirm = false;
    this.deleteMemberConfirm  = null;
    this.panelMode = 'create-project';
  }

  openEditProject(proj: ProjectInfo, event?: Event): void {
    event?.stopPropagation();
    this.selectProject(proj);
    this.projectForm = { name: proj.name, status: proj.status };
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
      this._pendingProjectName = name;
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
      startDate:  this.toInputDate(member.startDate),
      endDate:    this.toInputDate(member.endDate)
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
        if (autoSelect) this._autoSelectProjectName = autoSelect;
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
}
