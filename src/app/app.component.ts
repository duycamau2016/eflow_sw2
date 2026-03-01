import { Component } from '@angular/core';
import { Employee, ImportResult, OrgNode } from './models/employee.model';
import { ExcelImportService } from './services/excel-import.service';

type ActiveMenu = 'orgchart' | 'projects' | 'employees' | 'import' | 'none';

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
  activeMenu: ActiveMenu = 'none';
  isSampleLoading = false;
  isDarkTheme = true;
  isMobileNavOpen = false;

  stats = { total: 0, departments: 0, projects: 0, levels: 0 };

  constructor(private excelService: ExcelImportService) {
    // Áp dụng dark theme mặc định ngay lập tức
    document.body.classList.add('dark-theme');

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
      this.activeMenu = 'orgchart';
    }
  }

  toggleImportPanel(): void {
    this.showImportPanel = !this.showImportPanel;
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    document.body.classList.toggle('dark-theme', this.isDarkTheme);
  }

  toggleMobileNav(): void {
    this.isMobileNavOpen = !this.isMobileNavOpen;
  }

  closeMobileNav(): void {
    this.isMobileNavOpen = false;
  }

  selectMenu(menu: ActiveMenu): void {
    this.activeMenu = menu;
    this.isMobileNavOpen = false;
    if (menu === 'orgchart') {
      if (!this.hasData) {
        this.loadSampleData();
      } else {
        this.showImportPanel = false;
      }
    }
    if (menu === 'projects' && !this.hasData) {
      this.loadSampleData();
    }
    if (menu === 'employees' && !this.hasData) {
      this.loadSampleData();
    }
  }

  async loadSampleData(): Promise<void> {
    if (this.isSampleLoading) return;
    this.isSampleLoading = true;
    try {
      const result = await this.excelService.loadFromUrl('assets/data/sample-data-55emp-6proj.xlsx');
      this.importResult = result;
      this.hasData = result.employees.length > 0;
      if (this.hasData) {
        this.showImportPanel = false;
      }
    } catch (err) {
      console.error('Không thể tải dữ liệu mẫu', err);
    } finally {
      this.isSampleLoading = false;
    }
  }

  private computeStats(): void {
    const depts = new Set(this.allEmployees.map(e => e.department).filter(Boolean));
    const allProjects = this.allEmployees.flatMap(e => e.projects ?? []);
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
    this.activeMenu = 'none';
    this.excelService.clearData();
  }
}
