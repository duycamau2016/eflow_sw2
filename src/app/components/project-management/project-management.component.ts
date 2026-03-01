import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Employee, Project } from '../../models/employee.model';

export interface ProjectInfo {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'pending';
  memberCount: number;
  members: ProjectMember[];
}

export interface ProjectMember {
  employee: Employee;
  role: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending';
  children: ProjectMember[];
}

@Component({
  selector: 'app-project-management',
  templateUrl: './project-management.component.html',
  styleUrls: ['./project-management.component.scss']
})
export class ProjectManagementComponent implements OnChanges {
  @Input() allEmployees: Employee[] = [];

  @ViewChild('treeWrapper') treeWrapperRef!: ElementRef<HTMLElement>;

  projects: ProjectInfo[] = [];
  filteredProjects: ProjectInfo[] = [];
  selectedProject: ProjectInfo | null = null;
  projectTree: ProjectMember[] = [];
  searchQuery = '';
  memberSearch = '';
  statusFilter: string = 'all';
  expandedNodes = new Set<string>();

  viewMode: 'tree' | 'table' = 'tree';

  tablePage = 0;
  readonly tablePageSize = 10;

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
        const key = proj.name.trim();
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: key,
            status: proj.status,
            memberCount: 0,
            members: []
          });
        }
        const info = map.get(key)!;
        info.memberCount++;
        // Ưu tiên status active > pending > completed
        if (proj.status === 'active') info.status = 'active';
        else if (proj.status === 'pending' && info.status !== 'active') info.status = 'pending';
        info.members.push({
          employee: emp,
          role: proj.role,
          startDate: proj.startDate,
          endDate: proj.endDate,
          status: proj.status,
          children: []
        });
      }
    }

    this.projects = Array.from(map.values()).sort((a, b) => {
      const order = { active: 0, pending: 1, completed: 2 };
      return order[a.status] - order[b.status] || a.name.localeCompare(b.name, 'vi');
    });

    this.applyProjectFilter();

    if (this.selectedProject) {
      const updated = this.projects.find(p => p.id === this.selectedProject!.id);
      this.selectProject(updated ?? null);
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
    this.selectedProject = proj;
    this.memberSearch = '';
    this.tablePage = 0;
    this.expandedNodes.clear();
    this.viewMode = 'tree';
    if (proj) {
      this.projectTree = this.buildMemberTree(proj.members);
      // Expand all nodes by default
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
}
