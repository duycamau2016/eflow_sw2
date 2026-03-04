import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

/**
 * Thin wrapper quanh MatSnackBar để hiển thị toast notification
 * nhất quán toàn ứng dụng.
 *
 * Dùng:
 *   this.toast.success('Lưu thành công');
 *   this.toast.error('Bạn không có quyền thực hiện thao tác này');
 *   this.toast.info('Đang tải dữ liệu...');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {

  constructor(private snackBar: MatSnackBar) {}

  success(message: string, duration = 3000): void {
    this.show(message, 'toast-success', duration);
  }

  error(message: string, duration = 5000): void {
    this.show(message, 'toast-error', duration);
  }

  info(message: string, duration = 3000): void {
    this.show(message, 'toast-info', duration);
  }

  warning(message: string, duration = 4000): void {
    this.show(message, 'toast-warning', duration);
  }

  private show(message: string, panelClass: string, duration: number): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: [panelClass],
    };
    this.snackBar.open(message, '✕', config);
  }

  /**
   * Trích xuất message từ HttpErrorResponse của Spring Boot:
   *   err.error?.message  → từ ApiResponse wrapper
   *   err.message         → fallback
   */
  static extractMessage(err: any, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.'): string {
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }
}
