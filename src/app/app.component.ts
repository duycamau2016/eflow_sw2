import { Component } from '@angular/core';
import { Employee, ImportResult, OrgNode } from './models/employee.model';
import { ExcelImportService } from './services/excel-import.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'eFlow SW2 - Sơ đồ Phân cấp Nhân sự SW2';

  orgTree: OrgNode[] = [];
  allEmployees: Employee[] = [];
  hasData = false;
  showImportPanel = true;
  importResult: ImportResult | null = null;

  stats = { total: 0, departments: 0, projects: 0, levels: 0 };

  constructor(private excelService: ExcelImportService) {
    this.excelService.employees$.subscribe(employees => {
      this.allEmployees = employees;
      this.computeStats();
    });
    this.excelService.orgTree$.subscribe(tree => {
      this.orgTree = tree;
    });
  }

  onImportDone(result: ImportResult): void {
    this.importResult = result;
    this.hasData = result.employees.length > 0;
    if (this.hasData) {
      this.showImportPanel = false;
    }
  }

  toggleImportPanel(): void {
    this.showImportPanel = !this.showImportPanel;
  }

  private computeStats(): void {
    const depts = new Set(this.allEmployees.map(e => e.department).filter(Boolean));
    const allProjects = this.allEmployees.flatMap(e => e.projects);
    const projNames = new Set(allProjects.map(p => p.name).filter(Boolean));
    const maxLevel = this.allEmployees.reduce((max, e) => Math.max(max, e.level), 0);

    this.stats = {
      total: this.allEmployees.length,
      departments: depts.size,
      projects: projNames.size,
      levels: maxLevel + 1
    };
  }

  onClearData(): void {
    this.hasData = false;
    this.showImportPanel = true;
    this.importResult = null;
    this.excelService.clearData();
  }
}
