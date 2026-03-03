import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe dùng chung để hiển thị ngày theo định dạng dd/MM/yyyy.
 * Chấp nhận các định dạng đầu vào:
 *   - yyyy-MM-dd  (ISO, từ API)
 *   - dd/MM/yyyy  (đã format, trả về nguyên)
 *   - null / undefined / '' → trả về '—'
 *
 * Dùng trong template: {{ value | formatDate }}
 */
@Pipe({ name: 'formatDate' })
export class FormatDatePipe implements PipeTransform {
  transform(value?: string | null): string {
    if (!value) return '—';

    // yyyy-MM-dd → dd/MM/yyyy
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

    // dd/MM/yyyy hoặc d/M/yyyy (đã đúng định dạng, chuẩn hoá padding)
    const dmyMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
    }

    return value; // trả nguyên nếu không nhận dạng được
  }
}
