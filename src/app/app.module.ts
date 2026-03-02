import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';

// Components
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ExcelImportComponent } from './components/excel-import/excel-import.component';
import { OrgChartComponent } from './components/org-chart/org-chart.component';
import { OrgNodeComponent } from './components/org-chart/org-node.component';
import { EmployeeDetailComponent } from './components/employee-detail/employee-detail.component';
import { ProjectManagementComponent } from './components/project-management/project-management.component';
import { EmployeeManagementComponent } from './components/employee-management/employee-management.component';
import { LoginComponent } from './components/login/login.component';
import { SearchableSelectComponent } from './components/searchable-select/searchable-select.component';

@NgModule({
  declarations: [
    AppComponent,
    ExcelImportComponent,
    OrgChartComponent,
    OrgNodeComponent,
    EmployeeDetailComponent,
    ProjectManagementComponent,
    EmployeeManagementComponent,
    LoginComponent,
    SearchableSelectComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    // Angular Material modules
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatCheckboxModule,
    MatSidenavModule,
    MatListModule,
    MatProgressBarModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent],
  entryComponents: [EmployeeDetailComponent, LoginComponent]
})
export class AppModule {}
