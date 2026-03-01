import { Component, Output, EventEmitter } from '@angular/core';
import { ExcelImportService } from '../../services/excel-import.service';
import { ImportResult } from '../../models/employee.model';

@Component({
  selector: 'app-excel-import',
  templateUrl: './excel-import.component.html',
  styleUrls: ['./excel-import.component.scss']
})
export class ExcelImportComponent {
  @Output() importDone = new EventEmitter<ImportResult>();
  @Output() resetDone = new EventEmitter<void>();

  isDragOver = false;
  isLoading = false;
  importResult: ImportResult | null = null;
  errorMessage = '';
  selectedFileName = '';

  constructor(private excelService: ExcelImportService) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  async processFile(file: File): Promise<void> {
    // Kiểm tra định dạng file
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      this.errorMessage = 'Chỉ hỗ trợ file Excel (.xlsx, .xls) hoặc CSV (.csv)';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.selectedFileName = file.name;

    try {
      const result = await this.excelService.parseExcelFile(file);
      this.importResult = result;
      if (result.success && result.employees.length > 0) {
        this.importDone.emit(result);
      } else if (result.employees.length === 0) {
        this.errorMessage = 'File không có dữ liệu hợp lệ. Vui lòng kiểm tra lại cấu trúc file.';
      }
    } catch (err: any) {
      this.errorMessage = err.errors?.[0] || 'Lỗi khi xử lý file Excel';
    } finally {
      this.isLoading = false;
    }
  }

  downloadTemplate(): void {
    this.excelService.downloadTemplate();
  }

  reset(): void {
    this.importResult = null;
    this.errorMessage = '';
    this.selectedFileName = '';
    this.excelService.clearData();
    this.resetDone.emit();
  }
}
