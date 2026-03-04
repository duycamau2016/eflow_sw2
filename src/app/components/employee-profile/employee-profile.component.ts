import {
  Component, Input, OnChanges, SimpleChanges
} from '@angular/core';
import { Employee } from '../../models/employee.model';

@Component({
  selector: 'app-employee-profile',
  templateUrl: './employee-profile.component.html',
  styleUrls: ['./employee-profile.component.scss']
})
export class EmployeeProfileComponent implements OnChanges {

  @Input() employee!: Employee;
  @Input() allEmployees: Employee[] = [];
  @Input() isAdmin = false;

  subordinates: Employee[] = [];
  activeProjects: any[]   = [];
  pastProjects:   any[]   = [];
  manager:        Employee | undefined;

  readonly tenureLabel = (joinDate: string | null | undefined): string => {
    if (!joinDate) return '—';
    const d    = new Date(joinDate);
    const now  = new Date();
    const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (months < 1)  return 'Mới vào';
    if (months < 12) return `${months} tháng`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m > 0 ? `${y} năm ${m} tháng` : `${y} năm`;
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (this.employee && this.allEmployees.length) {
      this.buildProfile();
    }
  }

  private buildProfile(): void {
    const emp = this.employee;

    // Manager
    this.manager = emp.managerId
      ? this.allEmployees.find(e => e.id === emp.managerId)
      : undefined;

    // Subordinates (direct)
    this.subordinates = this.allEmployees.filter(e => e.managerId === emp.id);

    // Projects
    const projs = emp.projects ?? [];
    this.activeProjects = projs.filter(p => p.status === 'active');
    this.pastProjects   = projs.filter(p => p.status !== 'active');
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  levelLabel(lvl: number): string {
    return `Cấp ${lvl + 1}`;
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      active: 'Đang thực hiện', completed: 'Hoàn thành', pending: 'Chờ triển khai'
    };
    return m[s] ?? s;
  }

  statusClass(s: string): string {
    return `ep-proj-status--${s}`;
  }

  avatarInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
}
