import { Injectable } from '@angular/core';
import { Employee, OrgNode } from '../models/employee.model';
import { ProjectInfo, ProjectMember } from '../components/project-management/project-management.component';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class ExportService {

  // -------------------------------------------------------
  // Xuất Excel: 3 sheets — Nhân sự, Dự án, Phân cấp
  // -------------------------------------------------------
  exportExcel(employees: Employee[], filename = 'so_do_phan_cap_nhan_su'): void {
    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Danh sách nhân sự ---
    const hrRows = [
      ['Mã NV', 'Họ và tên', 'Chức vụ', 'Phòng ban', 'Email', 'Số điện thoại',
       'Mã quản lý', 'Tên quản lý', 'Cấp bậc', 'Ngày vào làm', 'Số cấp dưới']
    ];
    employees.forEach(e => {
      hrRows.push([
        e.id, e.name, e.position, e.department,
        e.email, e.phone,
        e.managerId || '',
        this.getManagerName(e.managerId, employees),
        `Cấp ${e.level + 1}`,
        e.joinDate || '',
        String(e.subordinatesCount ?? 0)
      ]);
    });
    const hrSheet = XLSX.utils.aoa_to_sheet(hrRows);
    hrSheet['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 20 }, { wch: 20 },
      { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 22 },
      { wch: 10 }, { wch: 14 }, { wch: 12 }
    ];

    // --- Sheet 2: Dự án ---
    const projRows = [
      ['Mã NV', 'Họ và tên', 'Phòng ban', 'Tên dự án', 'Vai trò',
       'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái']
    ];
    employees.forEach(e => {
      (e.projects ?? []).forEach(p => {
        projRows.push([
          e.id, e.name, e.department,
          p.name, p.role,
          p.startDate || '', p.endDate || '',
          this.translateStatus(p.status)
        ]);
      });
    });
    const projSheet = XLSX.utils.aoa_to_sheet(projRows);
    projSheet['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 20 }, { wch: 26 },
      { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
    ];

    // --- Sheet 3: Phân cấp (tree view dạng flat có indent) ---
    const hierarchyRows = [['Phân cấp', 'Mã NV', 'Họ và tên', 'Chức vụ', 'Phòng ban', 'Số dự án', 'Số cấp dưới']];
    const flattenedWithLevel = this.flattenByLevel(employees);
    flattenedWithLevel.forEach(e => {
      const indent = '    '.repeat(e.level) + (e.level > 0 ? '└─ ' : '');
      hierarchyRows.push([
        indent + e.name,
        e.id, e.name, e.position, e.department,
        String(e.projects?.length ?? 0),
        String(e.subordinatesCount ?? 0)
      ]);
    });
    const hierSheet = XLSX.utils.aoa_to_sheet(hierarchyRows);
    hierSheet['!cols'] = [
      { wch: 40 }, { wch: 10 }, { wch: 22 },
      { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, hrSheet, 'Nhân sự');
    XLSX.utils.book_append_sheet(wb, projSheet, 'Dự án');
    XLSX.utils.book_append_sheet(wb, hierSheet, 'Phân cấp');

    XLSX.writeFile(wb, `${filename}_${this.dateStamp()}.xlsx`);
  }

  // -------------------------------------------------------
  // Xuất Excel: danh sách thành viên 1 dự án
  // -------------------------------------------------------
  exportProjectMembers(project: ProjectInfo, members: ProjectMember[]): void {
    const wb = XLSX.utils.book_new();

    const rows: (string | number)[][] = [[
      'Mã NV', 'Họ và tên', 'Chức vụ', 'Phòng ban',
      'Vai trò trong dự án', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái'
    ]];

    const flatten = (list: ProjectMember[]): ProjectMember[] => {
      const result: ProjectMember[] = [];
      list.forEach(m => { result.push(m); if (m.children?.length) result.push(...flatten(m.children)); });
      return result;
    };

    flatten(members).forEach(m => {
      rows.push([
        m.employee.id ?? '',
        m.employee.name ?? '',
        m.employee.position ?? '',
        m.employee.department ?? '',
        m.role ?? '',
        m.startDate ?? '',
        m.endDate   ?? '',
        this.translateStatus(m.status)
      ]);
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 10 }, { wch: 24 }, { wch: 22 }, { wch: 22 },
      { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, sheet, 'Thành viên');
    XLSX.writeFile(wb, `du_an_${this._safeName(project.name)}_${this.dateStamp()}.xlsx`);
  }

  private _safeName(s: string): string {
    return s.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF _-]/g, '').replace(/\s+/g, '_');
  }

  // -------------------------------------------------------
  // Xuất PDF: chụp DOM element bằng html2canvas → jsPDF
  // -------------------------------------------------------
  async exportPdf(
    chartElement: HTMLElement,
    employees: Employee[],
    filename = 'so_do_phan_cap_nhan_su'
  ): Promise<void> {
    // Dynamic import để không tăng bundle size khi không dùng
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    // Chụp toàn bộ canvas kể cả phần bị ẩn do scroll
    const canvas = await html2canvas(chartElement, {
      scale: 2,              // độ phân giải gấp đôi
      useCORS: true,
      backgroundColor: '#f0f2f5',
      scrollX: 0,
      scrollY: 0,
      width: chartElement.scrollWidth,
      height: chartElement.scrollHeight,
      windowWidth: chartElement.scrollWidth,
      windowHeight: chartElement.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth  = canvas.width;
    const imgHeight = canvas.height;

    // Tính kích thước trang PDF (Landscape A4 hoặc lớn hơn nếu sơ đồ rộng)
    const PDF_MAX_WIDTH  = 297; // mm (A4 landscape)
    const PDF_MAX_HEIGHT = 210;
    const MM_PER_PX = 0.264583;

    const pxW = imgWidth  / 2; // chia 2 vì scale=2
    const pxH = imgHeight / 2;

    let pdfW = pxW * MM_PER_PX;
    let pdfH = pxH * MM_PER_PX;

    // Nếu rộng hơn A4, scale xuống vừa trang
    if (pdfW > PDF_MAX_WIDTH) {
      const ratio = PDF_MAX_WIDTH / pdfW;
      pdfW = PDF_MAX_WIDTH;
      pdfH = pdfH * ratio;
    }

    const orientation: 'landscape' | 'portrait' = pdfW > pdfH ? 'landscape' : 'portrait';
    const pageW = Math.max(pdfW + 20, orientation === 'landscape' ? PDF_MAX_WIDTH : 210);
    const pageH = Math.max(pdfH + 30, orientation === 'landscape' ? PDF_MAX_HEIGHT : 297);

    const pdf = new jsPDF({ orientation, unit: 'mm', format: [pageW, pageH] });

    // Tiêu đề
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(63, 81, 181);
    pdf.text('SO DO PHAN CAP NHAN SU', pageW / 2, 10, { align: 'center' });

    // Thông tin
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const depts = new Set(employees.map(e => e.department)).size;
    pdf.text(
      `Tong nhan vien: ${employees.length}  |  Phong ban: ${depts}  |  Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`,
      pageW / 2, 16, { align: 'center' }
    );

    // Ảnh sơ đồ
    pdf.addImage(imgData, 'PNG', 10, 20, pdfW, pdfH);

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(180, 180, 180);
    pdf.text('eFlow SW2 - So do phan cap nhan su', pageW / 2, pageH - 4, { align: 'center' });

    pdf.save(`${filename}_${this.dateStamp()}.pdf`);
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  private getManagerName(managerId: string | null, employees: Employee[]): string {
    if (!managerId) return '';
    return employees.find(e => e.id === managerId)?.name || managerId;
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      active: 'Đang thực hiện',
      completed: 'Hoàn thành',
      pending: 'Chờ bắt đầu'
    };
    return map[status] || status;
  }

  private flattenByLevel(employees: Employee[]): Employee[] {
    // Sắp xếp: cấp cha trước, sau đó con theo managerId
    const result: Employee[] = [];
    const addNode = (managerId: string | null, level: number) => {
      employees
        .filter(e => e.managerId === managerId)
        .forEach(e => {
          result.push(e);
          addNode(e.id, level + 1);
        });
    };
    addNode(null, 0);
    return result;
  }

  private dateStamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }
}
