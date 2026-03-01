import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Employee } from '../../models/employee.model';

export interface EmployeeDialogData {
  employee: Employee;
  manager: Employee | null;
  subordinates: Employee[];
}

@Component({
  selector: 'app-employee-detail',
  templateUrl: './employee-detail.component.html',
  styleUrls: ['./employee-detail.component.scss']
})
export class EmployeeDetailComponent {
  activeTab: 'info' | 'projects' | 'subordinates' = 'info';

  constructor(
    public dialogRef: MatDialogRef<EmployeeDetailComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EmployeeDialogData
  ) {}

  get initials(): string {
    return this.data.employee.name
      .split(' ')
      .slice(-2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Đang thực hiện',
      completed: 'Hoàn thành',
      pending: 'Chờ bắt đầu'
    };
    return map[status] || status;
  }

  close(): void {
    this.dialogRef.close();
  }
}
