import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Employee } from '../../models/employee.model';

interface DeptStat {
  name: string;
  count: number;
  pct: number;
  color: string;
}

interface ProjectStat {
  name: string;
  memberCount: number;
  status: 'active' | 'pending' | 'completed';
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnChanges {
  @Input() allEmployees: Employee[] = [];

  readonly todayStr = (() => {
    const d = new Date();
    const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${days[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}`;
  })();

  deptStats: DeptStat[] = [];
  recentEmployees: Employee[] = [];
  topProjects: ProjectStat[] = [];

  private readonly DEPT_COLORS = [
    '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
    '#a855f7', '#06b6d4'
  ];

  // ── KPI getters ──────────────────────────────────────────────────────────
  get totalEmployees(): number { return this.allEmployees.length; }

  get newThisMonth(): number {
    const now = new Date();
    return this.allEmployees.filter(e => {
      if (!e.joinDate) return false;
      const d = this.parseDate(e.joinDate);
      return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }

  get departmentCount(): number {
    return new Set(this.allEmployees.map(e => e.department).filter(Boolean)).size;
  }

  get levelCount(): number {
    return this.allEmployees.reduce((m, e) => Math.max(m, e.level), 0) + 1;
  }

  get activeProjectCount(): number   { return this.countUniqueProjects('active'); }
  get completedProjectCount(): number { return this.countUniqueProjects('completed'); }
  get pendingProjectCount(): number   { return this.countUniqueProjects('pending'); }
  get totalProjectCount(): number     { return this.countUniqueProjects(); }

  get overloadedCount(): number {
    return this.allEmployees.filter(e =>
      (e.projects ?? []).filter(p => p.status === 'active').length > 3
    ).length;
  }

  get avgProjectsPerEmployee(): string {
    if (!this.allEmployees.length) return '0';
    const total = this.allEmployees.reduce((s, e) => s + (e.projects?.length ?? 0), 0);
    return (total / this.allEmployees.length).toFixed(1);
  }

  /** CSS conic-gradient string for project status donut */
  get projectDonutStyle(): string {
    const a = this.activeProjectCount;
    const d = this.completedProjectCount;
    const p = this.pendingProjectCount;
    const total = a + d + p || 1;
    const aPct = (a / total) * 100;
    const dPct = aPct + (d / total) * 100;
    return `conic-gradient(#10b981 0% ${aPct.toFixed(1)}%, #3b82f6 ${aPct.toFixed(1)}% ${dPct.toFixed(1)}%, #f59e0b ${dPct.toFixed(1)}% 100%)`;
  }

  get projectActivePercent(): number {
    return this.totalProjectCount ? Math.round((this.activeProjectCount / this.totalProjectCount) * 100) : 0;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allEmployees']) this.computeDerived();
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  private countUniqueProjects(status?: string): number {
    const all = this.allEmployees.flatMap(e => e.projects ?? []);
    const f = status ? all.filter(p => p.status === status) : all;
    return new Set(f.map(p => p.name)).size;
  }

  private computeDerived(): void {
    // Department stats
    const deptMap = new Map<string, number>();
    for (const e of this.allEmployees) {
      const d = e.department || 'Chưa xác định';
      deptMap.set(d, (deptMap.get(d) ?? 0) + 1);
    }
    const empTotal = this.allEmployees.length || 1;
    this.deptStats = Array.from(deptMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count], i) => ({
        name, count,
        pct: Math.round((count / empTotal) * 100),
        color: this.DEPT_COLORS[i % this.DEPT_COLORS.length]
      }));

    // Recent employees (sorted desc by joinDate)
    this.recentEmployees = [...this.allEmployees]
      .filter(e => !!e.joinDate)
      .sort((a, b) => {
        const da = this.parseDate(a.joinDate!)?.getTime() ?? 0;
        const db = this.parseDate(b.joinDate!)?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, 8);

    // Top projects by member count
    const projMap = new Map<string, { members: Set<string>; statuses: string[] }>();
    for (const e of this.allEmployees) {
      for (const p of (e.projects ?? [])) {
        if (!projMap.has(p.name)) projMap.set(p.name, { members: new Set(), statuses: [] });
        projMap.get(p.name)!.members.add(e.id);
        projMap.get(p.name)!.statuses.push(p.status);
      }
    }
    this.topProjects = Array.from(projMap.entries())
      .map(([name, { members, statuses }]) => ({
        name,
        memberCount: members.size,
        status: this.dominantStatus(statuses) as 'active' | 'pending' | 'completed'
      }))
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 8);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private dominantStatus(statuses: string[]): string {
    const c = { active: 0, pending: 0, completed: 0 };
    for (const s of statuses) if (s in c) (c as any)[s]++;
    if (c.active > 0) return 'active';
    if (c.pending > 0) return 'pending';
    return 'completed';
  }

  private parseDate(value: string): Date | null {
    if (!value) return null;
    const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return null;
  }

  getAvatarColor(name: string): string {
    const palette = ['#4f46e5', '#7c3aed', '#db2777', '#059669', '#d97706', '#dc2626', '#0891b2'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase();
  }

  getStatusLabel(s: string): string {
    const map: Record<string, string> = { active: 'Đang thực hiện', completed: 'Hoàn thành', pending: 'Chờ triển khai' };
    return map[s] ?? s;
  }

  getMaxMemberCount(): number {
    return this.topProjects.reduce((m, p) => Math.max(m, p.memberCount), 1);
  }
}
