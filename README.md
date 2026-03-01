# eFlow SW2 - Sơ đồ Phân cấp Nhân sự SW2

Ứng dụng Angular hiển thị sơ đồ tổ chức phân cấp nhân sự từ file Excel.

## 🚀 Cài đặt & Chạy

```bash
cd eflow-hr
npm install
npm start
```

Truy cập: http://localhost:4200

## 📋 Cấu trúc file Excel

File Excel cần có **2 sheet**:

### Sheet 1: `Nhân sự`
| Cột | Tên trường | Mô tả |
|-----|-----------|-------|
| A | ID | Mã nhân viên (duy nhất) |
| B | Họ và tên | Tên đầy đủ |
| C | Chức vụ | Vị trí công việc |
| D | Phòng ban | Phòng/bộ phận |
| E | Email | Địa chỉ email |
| F | Số điện thoại | SĐT liên hệ |
| G | ID quản lý | Mã nhân viên của cấp trên (để trống nếu là gốc) |
| H | Ngày vào làm | Định dạng dd/mm/yyyy |

### Sheet 2: `Dự án`
| Cột | Tên trường | Mô tả |
|-----|-----------|-------|
| A | ID nhân viên | Mã nhân viên tham gia |
| B | Tên dự án | Tên dự án |
| C | Vai trò | Vai trò trong dự án |
| D | Ngày bắt đầu | dd/mm/yyyy |
| E | Ngày kết thúc | dd/mm/yyyy (để trống nếu đang tiếp tục) |
| F | Trạng thái | active / completed / pending |

## ✨ Tính năng

- ✅ Import file Excel (.xlsx, .xls)
- ✅ Hiển thị sơ đồ phân cấp dạng cây
- ✅ Click vào node để xem thông tin chi tiết
- ✅ Xem dự án và nhân viên cấp dưới
- ✅ Tìm kiếm nhân viên
- ✅ Zoom in/out sơ đồ
- ✅ Thu gọn/mở rộng nhánh
- ✅ Tải file Excel mẫu
- ✅ Thống kê tổng quan

## 🏗️ Kiến trúc

```
src/app/
├── models/
│   └── employee.model.ts      # Interfaces: Employee, Project, OrgNode
├── services/
│   └── excel-import.service.ts # Xử lý parse Excel, build cây phân cấp
└── components/
    ├── excel-import/           # UI upload file
    ├── org-chart/              # Sơ đồ cây (container + node)
    └── employee-detail/        # Dialog chi tiết nhân viên
```
