import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  username = '';
  password = '';
  errorMsg = '';
  isLoading = false;
  hidePassword = true;
  isDarkTheme: boolean;

  constructor(
    private authService: AuthService,
    private dialogRef: MatDialogRef<LoginComponent>,
    @Inject(MAT_DIALOG_DATA) data: { isDarkTheme: boolean }
  ) {
    this.isDarkTheme = data?.isDarkTheme ?? false;
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMsg = 'Vui lòng nhập đầy đủ thông tin';
      return;
    }
    this.isLoading = true;
    this.errorMsg = '';

    this.authService.login(this.username.trim(), this.password).subscribe({
      next: res => {
        this.isLoading = false;
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMsg = res.message;
        }
      },
      error: err => {
        this.isLoading = false;
        this.errorMsg = err?.error?.message ?? 'Tên đăng nhập hoặc mật khẩu không đúng';
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
