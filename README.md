# eFlow SW2 — Frontend (Angular)

Ứng dụng **Angular** quản lý sơ đồ tổ chức và dự án nhân sự SW2.  
Kết nối với [eFlow Service](../../eFlowService) (Spring Boot REST API chạy trên cổng **8099**).

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
| Công cụ | Phiên bản tối thiểu |
|---------|-------------------|
| Node.js | 18.x trở lên |
| npm     | 9.x trở lên |
| Angular CLI | 17.x trở lên |

### Các bước

```bash
# 1. Di chuyển vào thư mục FE
cd eFlowFE/eflow_sw2

# 2. Cài đặt dependencies
npm install

# 3. Chạy development server
npm start
# hoặc
ng serve
```

Truy cập: **http://localhost:4200**

> ⚠️ Cần khởi động **eFlow Service** trước (port 8099) để có đầy đủ chức năng CRUD.  
> Nếu service chưa khởi động, app tự động fallback về file Excel mẫu (`assets/data/`).

---

## ✨ Tính năng

### 📊 Sơ đồ Tổ chức
- Hiển thị sơ đồ phân cấp nhân sự dạng cây (org-chart)
- Zoom in/out (Ctrl+Scroll hoặc pinch) và pan (kéo chuột)
- Thu gọn/mở rộng từng nhánh
- Click node để xem chi tiết nhân viên

### 👥 Quản lý Nhân sự
- Danh sách nhân viên toàn công ty (bảng + phân trang)
- Tìm kiếm theo tên, phòng ban, chức vụ
- CRUD đầy đủ: Thêm / Sửa / Xoá nhân viên
- Xem chi tiết: dự án đang tham gia, cấp dưới

### 📁 Quản lý Dự án
- Xem tất cả dự án dạng danh sách + sơ đồ thành viên
- Tìm kiếm & lọc theo trạng thái (Đang thực hiện / Chờ / Hoàn thành)
- **Trạng thái dự án độc lập** — không phụ thuộc vào trạng thái từng assignment
- CRUD đầy đủ:
  - **Tạo dự án** mới (chọn tên + trạng thái)
  - **Thêm thành viên** vào dự án hiện có (chọn qua dropdown tìm kiếm)
  - **Sửa** vai trò, ngày của từng assignment
  - **Đổi tên & trạng thái** dự án (cập nhật toàn bộ assignment)
  - **Xoá** dự án hoặc từng thành viên khỏi dự án
- Chế độ xem: Sơ đồ cây (org-chart) hoặc Bảng danh sách

### 🔍 Searchable Select (Dropdown tìm kiếm)
- Component `app-searchable-select` dùng chung cho toàn bộ ứng dụng
- Click vào ô mới hiển thị dropdown (không phải luôn mở)
- Có ô tìm kiếm nhanh trong dropdown
- `position: fixed` — thoát khỏi mọi `overflow: hidden` của ancestor
- Tự động mở lên trên nếu không đủ chỗ phía dưới viewport
- Hỗ trợ light & dark theme
- Dùng tại: chọn nhân viên (PM), trạng thái dự án (PM), quản lý trực tiếp (EM), trạng thái dự án trong form EM

### 📥 Import Excel
- Import file `.xlsx` / `.xls`
- Tự động sync dữ liệu lên Spring Boot API
- Hỗ trợ tải file Excel mẫu (55 nhân viên, 6 dự án)
- ⚠️ Chỉ tài khoản **Admin** mới có quyền import dữ liệu

### 🔐 Xác thực & Phân quyền
- Đăng nhập qua dialog (không reload trang)
- Phiên đăng nhập lưu trong `sessionStorage` (tự động xoá khi đóng tab)
- Hai cấp quyền:
  - **Admin** — toàn quyền: import Excel, thêm/sửa/xoá nhân viên & dự án
  - **Khách** — chỉ xem: sơ đồ tổ chức, danh sách nhân sự, danh sách dự án
- Giao diện tự ẩn các nút chỉnh sửa khi chưa đăng nhập

---

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
| H | Ngày vào làm | Định dạng `dd/MM/yyyy` |

### Sheet 2: `Dự án`
| Cột | Tên trường | Mô tả |
|-----|-----------|-------|
| A | ID nhân viên | Mã nhân viên tham gia |
| B | Tên dự án | Tên dự án |
| C | Vai trò | Vai trò trong dự án |
| D | Ngày bắt đầu | `dd/MM/yyyy` |
| E | Ngày kết thúc | `dd/MM/yyyy` (để trống nếu đang tiếp tục) |
| F | Trạng thái | `active` / `completed` / `pending` |

---

## 🏗️ Kiến trúc

```
src/
├── environments/
│   └── environment.ts              # API base URL (http://localhost:8099/api)
└── app/
    ├── app.module.ts               # Module root, import Material, HttpClient
    ├── app.component.ts/html/scss  # Shell: toolbar, sidenav, router-outlet logic
    ├── app-routing.module.ts
    ├── models/
    │   └── employee.model.ts       # Interfaces: Employee, Project, OrgNode, ImportResult
    ├── services/
    │   ├── eflow-api.service.ts    # HTTP client → Spring Boot REST API
    │   ├── excel-import.service.ts # Parse Excel, build org-tree, sync to API
    │   └── auth.service.ts         # Xác thực, quản lý phiên đăng nhập (sessionStorage)
    └── components/
        ├── excel-import/           # Upload & import file Excel (Admin only)
        ├── org-chart/              # Sơ đồ tổ chức (container + recursive node)
        ├── employee-detail/        # Dialog chi tiết nhân viên
        ├── employee-management/    # CRUD nhân sự (bảng + form)
        ├── project-management/     # CRUD dự án (sidebar list + tree/table view + form panel)        ├── searchable-select/      # Reusable dropdown có tìm kiếm (click-to-open, fixed position)        └── login/                  # Dialog đăng nhập (hỗ trợ dark/light theme)
```

---

## 🔗 API kết nối

Base URL được cấu hình trong `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8099/api'
};
```

| Service | URL |
|---------|-----|
| Frontend (Angular) | http://localhost:4200 |
| Backend (Spring Boot) | http://localhost:8099 |
| H2 Console (DB) | http://localhost:8099/h2-console |

---

## 🛠️ Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| Framework | Angular 17 |
| UI Components | Angular Material |
| Icons | Google Material Icons |
| Styles | SCSS |
| HTTP Client | Angular HttpClient |
| Excel Parse | SheetJS (xlsx) |
| Build tool | Angular CLI / Webpack |
| Auth | Stateless session (sessionStorage + Spring Boot endpoint) |
