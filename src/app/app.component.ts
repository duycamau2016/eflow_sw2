import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Employee, ImportResult, OrgNode } from './models/employee.model';
import { ExcelImportService } from './services/excel-import.service';
import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/login/login.component';

type ActiveMenu = 'dashboard' | 'orgchart' | 'projects' | 'employees' | 'import' | 'none';

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
  projectToSelect: string | null = null;

  // ─── Global Search ───────────────────────────────────────────────
  globalQuery       = '';
  globalSearchOpen  = false;

  get globalResults(): { employees: Employee[]; projects: string[] } {
    const q = this.globalQuery.toLowerCase().trim();
    if (!q || q.length < 1) return { employees: [], projects: [] };
    const employees = this.allEmployees
      .filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.id?.toLowerCase().includes(q)   ||
        e.position?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
      ).slice(0, 6);
    const projSet = new Set<string>();
    this.allEmployees.forEach(e => (e.projects ?? []).forEach(p => { if (p.name?.toLowerCase().includes(q)) projSet.add(p.name); }));
    return { employees, projects: Array.from(projSet).slice(0, 5) };
  }

  get hasGlobalResults(): boolean {
    const r = this.globalResults;
    return r.employees.length > 0 || r.projects.length > 0;
  }

  stats = { total: 0, departments: 0, projects: 0, levels: 0 };

  constructor(private excelService: ExcelImportService, private dialog: MatDialog, public authService: AuthService) {
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

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  openLogin(): void {
    this.dialog.open(LoginComponent, {
      width: '380px',
      disableClose: false,
      panelClass: this.isDarkTheme ? ['login-dialog-panel', 'dark-theme'] : ['login-dialog-panel'],
      data: { isDarkTheme: this.isDarkTheme }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  onImportDone(result: ImportResult): void {
    this.importResult = result;
    this.hasData = result.employees.length > 0;
    if (this.hasData) {
      this.showImportPanel = false;
      this.activeMenu = 'dashboard';
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

  onNavigateToProject(projectName: string): void {
    this.projectToSelect = projectName;
    this.activeMenu = 'projects';
    this.isMobileNavOpen = false;
    if (!this.hasData) this.loadSampleData();
  }

  onGlobalSelectEmployee(_emp: Employee): void {
    this.globalQuery      = '';
    this.globalSearchOpen = false;
    this.activeMenu       = 'employees';
    this.isMobileNavOpen  = false;
    if (!this.hasData) this.loadSampleData();
    // future: emit selected employee id for auto-open
  }

  onGlobalSelectProject(projName: string): void {
    this.globalQuery      = '';
    this.globalSearchOpen = false;
    this.onNavigateToProject(projName);
  }

  onGlobalBlur(): void {
    // Use timeout so click events on dropdown items fire first
    setTimeout(() => { this.globalSearchOpen = false; }, 150);
  }

  closeMobileNav(): void {
    this.isMobileNavOpen = false;
  }

  selectMenu(menu: ActiveMenu): void {
    this.activeMenu = menu;
    this.isMobileNavOpen = false;
    if (menu === 'dashboard') {
      if (!this.hasData) this.loadSampleData();
      else this.showImportPanel = false;
    }
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

    // 1. Thử tải từ Spring Boot API trước
    try {
      const result = await this.excelService.loadFromApi().toPromise();
      if (result && result.employees.length > 0) {
        this.importResult = result;
        this.hasData = true;
        this.showImportPanel = false;
        if (this.activeMenu === 'none') this.activeMenu = 'dashboard';
        this.isSampleLoading = false;
        console.log(`[eFlow] Loaded ${result.total} employees from API`);
        return;
      }
    } catch {
      // API chưa khởi động hoặc không có dữ liệu → fallback về Excel mẫu
    }

    // 2. Fallback: tải file Excel mẫu từ assets
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
