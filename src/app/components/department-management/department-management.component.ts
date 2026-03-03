import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { Employee } from '../../models/employee.model';
import { DepartmentService } from '../../services/department.service';
import { DepartmentApiDTO } from '../../services/eflow-api.service';

interface DeptRow {
  id: number;
  name: string;
  count: number;
  editing: boolean;
  editValue: string;
  saving: boolean;
}

@Component({
  selector: 'app-department-management',
  templateUrl: './department-management.component.html',
  styleUrls: ['./department-management.component.scss']
})
export class DepartmentManagementComponent implements OnChanges, OnDestroy {
  @Input() allEmployees: Employee[] = [];
  @Input() isAdmin = false;

  rows: DeptRow[] = [];
  newDeptName = '';
  newDeptError = '';
  deleteConfirmName: string | null = null;
  isAdding = false;

  // ─── Sort & paging ─────────────────────────────────────────────
  sortCol: 'name' | 'count' = 'count';
  sortDir: 'asc' | 'desc' = 'desc';
  page = 0;
  readonly pageSize = 15;

  private sub?: Subscription;

  constructor(public deptService: DepartmentService) {
    this.sub = this.deptService.depts$.subscribe(() => this.buildRows());
  }

  ngOnChanges(_changes: SimpleChanges): void {
    const depts = [...new Set(this.allEmployees.map(e => e.department).filter(Boolean) as string[])];
    this.deptService.seedFromEmployees(depts);
    this.buildRows();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private buildRows(): void {
    const all = this.deptService.getAll();
    this.rows = all.map(d => ({
      id: d.id,
      name: d.name,
      count: this.allEmployees.filter(e => e.department === d.name).length,
      editing: false,
      editValue: d.name,
      saving: false
    }));
  }

  get totalEmployees(): number { return this.allEmployees.length; }
  get totalDepts(): number { return this.rows.length; }
  get emptyDepts(): number { return this.rows.filter(r => r.count === 0).length; }

  // ── Add ───────────────────────────────────────────────────────────
  addDept(): void {
    this.newDeptError = '';
    const name = this.newDeptName.trim();
    if (!name) { this.newDeptError = 'Vui lòng nhập tên phòng ban.'; return; }
    this.isAdding = true;
    this.deptService.add(name).subscribe({
      next: () => { this.newDeptName = ''; this.page = 0; this.isAdding = false; },
      error: (err) => {
        this.newDeptError = err?.error?.message ?? 'Phòng ban đã tồn tại hoặc có lỗi.';
        this.isAdding = false;
      }
    });
  }

  // ── Rename ────────────────────────────────────────────────────────
  startEdit(row: DeptRow): void {
    this.rows.forEach(r => { r.editing = false; });
    row.editing = true;
    row.editValue = row.name;
  }

  cancelEdit(row: DeptRow): void {
    row.editing = false;
    row.editValue = row.name;
  }

  saveEdit(row: DeptRow): void {
    const trimmed = row.editValue.trim();
    if (!trimmed || trimmed === row.name) { row.editing = false; return; }
    row.saving = true;
    this.deptService.rename(row.id, trimmed).subscribe({
      next: () => { row.editing = false; row.saving = false; },
      error: () => { row.editValue = row.name; row.editing = false; row.saving = false; }
    });
  }

  // ── Delete ────────────────────────────────────────────────────────
  requestDelete(name: string): void { this.deleteConfirmName = name; }
  cancelDelete(): void { this.deleteConfirmName = null; }

  confirmDelete(name: string): void {
    const row = this.rows.find(r => r.name === name);
    if (!row) { this.deleteConfirmName = null; return; }
    this.deptService.remove(row.id).subscribe({
      next: () => { this.deleteConfirmName = null; this.page = Math.max(0, Math.min(this.page, this.totalPages - 1)); },
      error: () => { this.deleteConfirmName = null; }
    });
  }

  // ─── Sort & paging methods ─────────────────────────────────────
  sort(col: 'name' | 'count'): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = col === 'count' ? 'desc' : 'asc';
    }
    this.page = 0;
  }

  get sortedRows(): DeptRow[] {
    return [...this.rows].sort((a, b) => {
      const cmp = this.sortCol === 'name'
        ? a.name.localeCompare(b.name, 'vi')
        : a.count - b.count;
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  get pagedRows(): DeptRow[] {
    const maxPage = Math.max(0, this.totalPages - 1);
    if (this.page > maxPage) this.page = maxPage;
    const start = this.page * this.pageSize;
    return this.sortedRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.rows.length / this.pageSize));
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

  get paginationEnd(): number {
    return Math.min((this.page + 1) * this.pageSize, this.rows.length);
  }
}
