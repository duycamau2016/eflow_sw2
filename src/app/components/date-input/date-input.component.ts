import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';

/**
 * Component nhập ngày dùng chung – format dd/MM/yyyy.
 *
 * - Auto-insert dấu '/' sau ngày và tháng khi user gõ
 * - Nhận / phát giá trị dạng 'dd/MM/yyyy'
 * - Cũng chấp nhận writeValue với ISO 'yyyy-MM-dd' (tự chuyển đổi)
 * - Validate ngày hợp lệ, hiển thị border đỏ nếu sai
 *
 * Sử dụng:
 *   <app-date-input [(ngModel)]="myDate" placeholder="Ngày bắt đầu" />
 */
@Component({
  selector: 'app-date-input',
  templateUrl: './date-input.component.html',
  styleUrls: ['./date-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true
    }
  ]
})
export class DateInputComponent implements ControlValueAccessor {
  @Input() placeholder = 'dd/MM/yyyy';
  @Input() isDisabled  = false;

  displayValue = '';
  pickerDate:  Date | null = null;
  isInvalid    = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ─── ControlValueAccessor ─────────────────────────────────────────────────

  /** Nhận giá trị từ ngModel – chấp nhận cả dd/MM/yyyy và yyyy-MM-dd */
  writeValue(value: string | null | undefined): void {
    if (!value) {
      this.displayValue = ''; this.pickerDate = null; this.isInvalid = false; return;
    }

    // yyyy-MM-dd → dd/MM/yyyy
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      this.displayValue = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
      this.pickerDate   = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
    } else {
      this.displayValue = value;
      const dmyMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dmyMatch) this.pickerDate = new Date(+dmyMatch[3], +dmyMatch[2] - 1, +dmyMatch[1]);
    }
    this.isInvalid = false;
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.isDisabled = isDisabled; }

  // ─── Xử lý nhập ──────────────────────────────────────────────────────────

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart ?? 0;
    const prev = this.displayValue;

    // Chỉ giữ lại chữ số
    const digits = input.value.replace(/\D/g, '').substring(0, 8);

    // Ghép lại dạng dd/MM/yyyy
    let formatted = '';
    if (digits.length > 0) formatted += digits.substring(0, 2);
    if (digits.length > 2) formatted += '/' + digits.substring(2, 4);
    if (digits.length > 4) formatted += '/' + digits.substring(4, 8);

    this.displayValue = formatted;
    input.value = formatted;

    // Khôi phục vị trí con trỏ hợp lý
    const delta = formatted.length - prev.length;
    const newPos = Math.max(0, cursorPos + delta);
    requestAnimationFrame(() => input.setSelectionRange(newPos, newPos));

    // Phát giá trị
    if (formatted.length === 10) {
      this.isInvalid = !this.isValidDate(formatted);
      if (!this.isInvalid) {
        const p = formatted.split('/');
        this.pickerDate = new Date(+p[2], +p[1] - 1, +p[0]);
      }
      this.onChange(this.isInvalid ? '' : formatted);
    } else {
      this.isInvalid  = false;
      this.pickerDate = null;
      this.onChange('');
    }
  }

  onBlur(): void {
    this.onTouched();
    if (this.displayValue.length > 0 && this.displayValue.length < 10) {
      this.isInvalid = true;
    } else if (this.displayValue.length === 10) {
      this.isInvalid = !this.isValidDate(this.displayValue);
    }
  }

  onClear(): void {
    this.displayValue = '';
    this.pickerDate   = null;
    this.isInvalid    = false;
    this.onChange('');
    this.onTouched();
  }

  onMatDateChange(event: MatDatepickerInputEvent<Date>): void {
    const d = event.value;
    if (!d) return;
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    this.displayValue = `${day}/${month}/${year}`;
    this.pickerDate   = d;
    this.isInvalid    = false;
    this.onChange(this.displayValue);
    this.onTouched();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private isValidDate(value: string): boolean {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    const day   = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year  = parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
           date.getMonth()    === month - 1 &&
           date.getDate()     === day;
  }
}
