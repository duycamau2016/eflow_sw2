import {
  Component, OnInit, OnDestroy, Input
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { EFlowApiService, AuditLogApiDTO } from '../../services/eflow-api.service';

@Component({
  selector: 'app-audit-log',
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.scss']
})
export class AuditLogComponent implements OnInit, OnDestroy {
  @Input() isAdmin = false;

  logs: AuditLogApiDTO[] = [];
  total = 0;
  isLoading = false;

  // Filters
  filterEntityType = '';
  filterAction     = '';
  filterActor      = '';

  // Pagination
  page = 0;
  readonly pageSize = 50;

  readonly entityTypeOptions = [
    { value: '',           label: 'Tất cả loại' },
    { value: 'EMPLOYEE',   label: 'Nhân viên' },
    { value: 'PROJECT',    label: 'Dự án' },
    { value: 'DEPARTMENT', label: 'Phòng ban' },
  ];

  readonly actionOptions = [
    { value: '',       label: 'Tất cả thao tác' },
    { value: 'CREATE', label: 'Tạo mới' },
    { value: 'UPDATE', label: 'Cập nhật' },
    { value: 'DELETE', label: 'Xóa' },
    { value: 'IMPORT', label: 'Import' },
  ];

  private destroy$ = new Subject<void>();
  private actorChange$ = new Subject<string>();

  constructor(private api: EFlowApiService) {}

  ngOnInit(): void {
    // Debounce actor filter
    this.actorChange$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => { this.page = 0; this.load(); });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.isLoading = true;
    this.api.getAuditLogs({
      entityType: this.filterEntityType || undefined,
      action:     this.filterAction     || undefined,
      actor:      this.filterActor      || undefined,
      page:       this.page,
      size:       this.pageSize
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.logs    = res.data;
          this.total   = res.total;
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
  }

  onEntityTypeChange(): void { this.page = 0; this.load(); }
  onActionChange():     void { this.page = 0; this.load(); }
  onActorInput():       void { this.actorChange$.next(this.filterActor); }

  resetFilters(): void {
    this.filterEntityType = '';
    this.filterAction     = '';
    this.filterActor      = '';
    this.page = 0;
    this.load();
  }

  get totalPages(): number { return Math.ceil(this.total / this.pageSize); }
  goTo(p: number): void { if (p >= 0 && p < this.totalPages) { this.page = p; this.load(); } }

  get hasFilters(): boolean {
    return !!(this.filterEntityType || this.filterAction || this.filterActor);
  }

  actionLabel(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'Tạo mới', UPDATE: 'Cập nhật', DELETE: 'Xóa', IMPORT: 'Import'
    };
    return map[action] ?? action;
  }

  entityLabel(type: string): string {
    const map: Record<string, string> = {
      EMPLOYEE: 'Nhân viên', PROJECT: 'Dự án', DEPARTMENT: 'Phòng ban'
    };
    return map[type] ?? type;
  }

  actionClass(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'al-badge-create',
      UPDATE: 'al-badge-update',
      DELETE: 'al-badge-delete',
      IMPORT: 'al-badge-import'
    };
    return map[action] ?? '';
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}
