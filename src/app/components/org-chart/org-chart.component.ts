import {
  Component, Input, OnChanges, SimpleChanges, Output,
  EventEmitter, ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OrgNode, Employee } from '../../models/employee.model';
import { EmployeeDetailComponent } from '../employee-detail/employee-detail.component';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-org-chart',
  templateUrl: './org-chart.component.html',
  styleUrls: ['./org-chart.component.scss']
})
export class OrgChartComponent implements OnChanges {
  @Input() orgTree: OrgNode[] = [];
  @Input() allEmployees: Employee[] = [];
  @Output() nodeClicked = new EventEmitter<Employee>();

  @ViewChild('chartWrapper')   chartWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('chartCanvas')    chartCanvasRef!: ElementRef<HTMLElement>;
  @ViewChild('chartZoomInner') chartZoomInnerRef!: ElementRef<HTMLElement>;

  searchQuery = '';
  zoomLevel = 0.7;
  readonly MIN_ZOOM = 0.3;
  readonly MAX_ZOOM = 2.0;

  filteredTree: OrgNode[] = [];
  highlightedIds = new Set<string>();
  isExporting = false;

  // Position filter
  selectedPositions: string[] = [];
  availablePositions: string[] = [];
  positionMenuSearch = '';

  // Level filter
  selectedLevels = new Set<number>([0, 1, 2]);
  availableLevels: number[] = [];
  maxAvailableLevel = 0;

  get maxSelectedLevel(): number {
    return this.selectedLevels.size === 0
      ? this.maxAvailableLevel
      : Math.max(...Array.from(this.selectedLevels));
  }

  get filteredPositionOptions(): string[] {
    const q = this.positionMenuSearch.toLowerCase();
    return q
      ? this.availablePositions.filter(p => p.toLowerCase().includes(q))
      : this.availablePositions;
  }

  // Pan state
  isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panScrollLeft = 0;
  private panScrollTop = 0;

  constructor(
    private dialog: MatDialog,
    private exportService: ExportService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orgTree'] || changes['allEmployees']) {
      this.searchQuery = '';
      this.highlightedIds.clear();
      this.selectedPositions = [];
      this.positionMenuSearch = '';
      this.buildAvailablePositions();
      this.buildAvailableLevels();
      this.applyFilters();

      // Sau khi render xong, tự động scale vừa khung nhìn
      if (this.allEmployees.length > 0) {
        setTimeout(() => { this.zoomLevel = 0.7; this.scrollToCenter(); }, 400);
      }
    }
  }

  onSearch(): void {
    this.applyFilters();
  }

  // -------------------------------------------------------
  // Position filter
  // -------------------------------------------------------
  private buildAvailablePositions(): void {
    const set = new Set<string>();
    this.allEmployees.forEach(e => { if (e.position) set.add(e.position.trim()); });
    this.availablePositions = Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }

  togglePosition(pos: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedPositions.includes(pos)) {
        this.selectedPositions = [...this.selectedPositions, pos];
      }
    } else {
      this.selectedPositions = this.selectedPositions.filter(p => p !== pos);
    }
    this.applyFilters();
  }

  removePositionFilter(pos: string): void {
    this.selectedPositions = this.selectedPositions.filter(p => p !== pos);
    this.applyFilters();
  }

  clearPositionFilter(): void {
    this.selectedPositions = [];
    this.positionMenuSearch = '';
    this.applyFilters();
  }

  // -------------------------------------------------------
  // Level filter
  // -------------------------------------------------------
  private buildAvailableLevels(): void {
    const max = this.allEmployees.reduce((m, e) => Math.max(m, e.level ?? 0), 0);
    this.maxAvailableLevel = max;
    this.availableLevels = Array.from({ length: max + 1 }, (_, i) => i);
    // Mặc định hiển thị cấp 1, 2, 3 (index 0,1,2)
    this.selectedLevels = new Set([0, 1, 2].filter(l => l <= max));
  }

  toggleLevel(level: number): void {
    if (this.selectedLevels.has(level)) {
      // Không cho phép bỏ chọn cấp 1 (root)
      if (level === 0) return;
      // Bỏ chọn level này và tất cả cấp sâu hơn
      for (let l = level; l <= this.maxAvailableLevel; l++) {
        this.selectedLevels.delete(l);
      }
    } else {
      // Chọn level này và tất cả cấp nông hơn (bảo đảm liên tục từ 0)
      for (let l = 0; l <= level; l++) {
        this.selectedLevels.add(l);
      }
    }
    this.selectedLevels = new Set(this.selectedLevels);
    this.applyFilters();
  }

  selectAllLevels(): void {
    this.selectedLevels = new Set(this.availableLevels);
    this.applyFilters();
  }

  // -------------------------------------------------------
  // Unified filter: text search + position + level
  // -------------------------------------------------------
  applyFilters(): void {
    this.highlightedIds.clear();
    const q = this.searchQuery.trim().toLowerCase();
    const hasPosFilter = this.selectedPositions.length > 0;

    if (q || hasPosFilter) {
      this.allEmployees.forEach(emp => {
        const matchSearch = !q ||
          emp.name.toLowerCase().includes(q) ||
          emp.position.toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q) ||
          emp.id.toLowerCase().includes(q);
        const matchPos = !hasPosFilter || this.selectedPositions.includes(emp.position);
        if (matchSearch && matchPos) this.highlightedIds.add(emp.id);
      });
    }

    this.filteredTree = this.filterTree(this.orgTree);
  }

  private filterTree(nodes: OrgNode[]): OrgNode[] {
    const maxLvl = this.maxSelectedLevel;
    const hasSearchFilter = this.highlightedIds.size > 0;
    const result: OrgNode[] = [];

    for (const node of nodes) {
      const lvl = node.employee.level ?? 0;
      if (lvl > maxLvl) continue;

      const filteredChildren = this.filterTree(node.children);

      if (hasSearchFilter) {
        if (this.highlightedIds.has(node.employee.id) || filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren, isExpanded: true });
        }
      } else {
        result.push({ ...node, children: filteredChildren, isExpanded: node.isExpanded });
      }
    }
    return result;
  }

  onSelectEmployee(employee: Employee): void {
    const manager = employee.managerId
      ? this.allEmployees.find(e => e.id === employee.managerId) || null
      : null;

    const subordinates = this.allEmployees.filter(e => e.managerId === employee.id);

    this.dialog.open(EmployeeDetailComponent, {
      width: '480px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'employee-dialog',
      data: { employee, manager, subordinates }
    });

    this.nodeClicked.emit(employee);
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(this.MAX_ZOOM, +(this.zoomLevel + 0.1).toFixed(2));
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(this.MIN_ZOOM, +(this.zoomLevel - 0.1).toFixed(2));
  }

  resetZoom(): void {
    this.zoomLevel = 0.7;
    setTimeout(() => this.scrollToCenter(), 50);
  }

  fitToView(): void {
    const wrapper = this.chartWrapperRef?.nativeElement;
    if (!wrapper) return;

    // CSS zoom scales the scrollable content dimensions proportionally:
    // scrollWidth = naturalWidth * zoomLevel  →  naturalWidth = scrollWidth / zoomLevel
    const naturalW = wrapper.scrollWidth / this.zoomLevel;
    const naturalH = wrapper.scrollHeight / this.zoomLevel;
    const viewW = wrapper.clientWidth;
    const viewH = wrapper.clientHeight;

    if (naturalW <= 0 || naturalH <= 0 || viewW <= 0 || viewH <= 0) return;

    const scaleX = viewW / naturalW;
    const scaleY = viewH / naturalH;
    // Take the smaller axis, with a slight padding margin (0.88)
    const fitZoom = Math.min(scaleX, scaleY) * 0.88;

    this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(1.0, +(fitZoom).toFixed(2)));
    setTimeout(() => this.scrollToCenter(), 50);
  }

  // -------------------------------------------------------
  // Mouse wheel: Ctrl+Wheel = zoom, normal wheel = scroll
  // -------------------------------------------------------
  onWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      this.zoomLevel = Math.min(
        this.MAX_ZOOM,
        Math.max(this.MIN_ZOOM, +(this.zoomLevel + delta).toFixed(2))
      );
    }
    // normal scroll: let browser handle it
  }

  // -------------------------------------------------------
  // Pan: click + drag to scroll
  // -------------------------------------------------------
  onPanStart(event: MouseEvent): void {
    // Chỉ pan bằng middle click hoặc Alt+left click
    if (event.button === 1 || event.altKey) {
      event.preventDefault();
      this.isPanning = true;
      const el = this.chartWrapperRef.nativeElement;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      this.panScrollLeft = el.scrollLeft;
      this.panScrollTop = el.scrollTop;
    }
  }

  onPanMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    event.preventDefault();
    const el = this.chartWrapperRef.nativeElement;
    el.scrollLeft = this.panScrollLeft - (event.clientX - this.panStartX);
    el.scrollTop  = this.panScrollTop  - (event.clientY - this.panStartY);
  }

  onPanEnd(): void {
    this.isPanning = false;
  }

  // -------------------------------------------------------
  // Scroll helpers
  // -------------------------------------------------------
  scrollToTop(): void {
    const el = this.chartWrapperRef?.nativeElement;
    if (el) el.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }

  scrollToCenter(): void {
    const el = this.chartWrapperRef?.nativeElement;
    if (el) {
      el.scrollTo({
        top: 0,
        left: (el.scrollWidth - el.clientWidth) / 2,
        behavior: 'smooth'
      });
    }
  }

  expandAll(nodes: OrgNode[] = this.filteredTree): void {
    nodes.forEach(node => {
      node.isExpanded = true;
      if (node.children) this.expandAll(node.children);
    });
    this.filteredTree = [...this.filteredTree];
  }

  collapseAll(nodes: OrgNode[] = this.filteredTree): void {
    nodes.forEach(node => {
      if (node.depth && node.depth > 0) {
        node.isExpanded = false;
      } else {
        node.isExpanded = true;
      }
      if (node.children) this.collapseAll(node.children);
    });
    this.filteredTree = [...this.filteredTree];
  }

  // -------------------------------------------------------
  // Export
  // -------------------------------------------------------
  async onExportPdf(): Promise<void> {
    if (this.isExporting) return;
    this.isExporting = true;
    try {
      const el = this.chartZoomInnerRef?.nativeElement ?? this.chartCanvasRef?.nativeElement;
      if (!el) return;
      const savedZoom = this.zoomLevel;
      this.zoomLevel = 1;
      await new Promise(r => setTimeout(r, 200));
      await this.exportService.exportPdf(el, this.allEmployees);
      this.zoomLevel = savedZoom;
    } finally {
      this.isExporting = false;
    }
  }

  onExportExcel(): void {
    this.exportService.exportExcel(this.allEmployees);
  }

  get zoomPercent(): number {
    return Math.round(this.zoomLevel * 100);
  }
}
