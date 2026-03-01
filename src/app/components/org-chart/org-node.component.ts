import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges
} from '@angular/core';
import { OrgNode, Employee } from '../../models/employee.model';

@Component({
  selector: 'app-org-node',
  templateUrl: './org-node.component.html',
  styleUrls: ['./org-node.component.scss']
})
export class OrgNodeComponent implements OnChanges {
  @Input() node!: OrgNode;
  @Input() allEmployees: Employee[] = [];
  @Output() selectEmployee = new EventEmitter<Employee>();

  isExpanded = true;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['node']) {
      this.isExpanded = this.node.isExpanded !== false;
    }
  }

  get initials(): string {
    return (this.node.employee.name || '')
      .split(' ')
      .slice(-2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  get hasChildren(): boolean {
    return this.node.children && this.node.children.length > 0;
  }

  toggleExpand(event: MouseEvent): void {
    event.stopPropagation();
    this.isExpanded = !this.isExpanded;
    this.node.isExpanded = this.isExpanded;
  }

  onSelect(event: MouseEvent): void {
    event.stopPropagation();
    this.selectEmployee.emit(this.node.employee);
  }

  onChildSelect(employee: Employee): void {
    this.selectEmployee.emit(employee);
  }
}
