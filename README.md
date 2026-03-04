# eFlow SW2 — Frontend (Angular)

Ứng dụng **Angular 15** quản lý nhân sự, sơ đồ tổ chức, dự án và phòng ban.  
Kết nối với [eFlow Service](../../eFlowService) (Spring Boot REST API chạy trên cổng **8099**).

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
| Công cụ | Phiên bản tối thiểu |
|---------|-------------------|
| Node.js | 18.x trở lên |
| npm     | 9.x trở lên |
| Angular CLI | 15.x trở lên (khuyến nghị 17.x) |

### Các bước

```bash
# 1. Di chuyển vào thư mục FE
cd eFlowFE/eflow_sw2

# 2. Cài đặt dependencies
npm install

# 3. Chạy development server
npm start
```

Truy cập: **http://localhost:4200**

> ⚠️ Cần khởi động **eFlow Service** trước (port 8099) để có đầy đủ chức năng CRUD.  
> Nếu service chưa khởi động, app tự động fallback về file Excel mẫu (`assets/data/`).

---

## ✨ Tính năng

### 🔐 Xác thực & Phân quyền
- Đăng nhập qua dialog (không reload trang)
- Phiên đăng nhập lưu trong `sessionStorage`
- **Admin** — toàn quyền: import Excel, thêm/sửa/xoá nhân viên, dự án, phòng ban, xem Lịch sử
- **Manager** — xem + sửa nhân viên thuộc phòng ban phụ trách; không import, không xoá
- **Khách** — chỉ xem
- `AuthInterceptor` tự động đính kèm header `X-Username` vào mọi HTTP request (dùng cho Audit Log)

#### 👔 Tài khoản Manager (Sprint 6)
| Username | Password | Phòng ban phụ trách |
|----------|----------|---------------------|
| `MGRKYTHUAT` | `Matkhau1!` | Kỹ thuật / Engineering |
| `MGRNHANSU` | `Matkhau1!` | Nhân sự / HR |
| `MGRDUAN` | `Matkhau1!` | Quản lý Dự án / PMO |

- `AuthService.isManager()` / `canEdit()` kiểm tra quyền chỉnh sửa từng nhân viên
- Manager chip màu vàng hiển thị trên toolbar khi đăng nhập bằng tài khoản Manager

### 📊 Sơ đồ Tổ chức
- Sơ đồ phân cấp nhân sự dạng cây (org-chart)
- Zoom in/out (Ctrl+Scroll / pinch) và pan (kéo chuột)
- Thu gọn/mở rộng từng nhánh
- Click node để xem chi tiết nhân viên

### 👥 Quản lý Nhân sự
- Danh sách nhân viên toàn công ty (bảng + phân trang 10 dòng)
- Tìm kiếm theo tên, mã NV, chức vụ, email
- Lọc theo phòng ban, cấp bậc, overload, bench
- Sort theo cột
- CRUD đầy đủ: Thêm / Sửa / Xoá nhân viên
- Xem chi tiết: dự án đang tham gia, cấp dưới, checklist onboarding
- **Xuất Excel** danh sách nhân viên (có/không lọc)
- **Xuất PDF** danh sách nhân viên (A4 landscape, jsPDF manual table)
- Badge workload: OK / Busy / Overload
- Thâm niên tính tự động từ ngày vào làm

### 🏢 Quản lý Phòng ban
- Màn hình riêng trong sidebar (menu "Phòng ban")
- Danh sách phòng ban + số nhân viên + thanh tỉ lệ
- Thống kê: tổng phòng ban, tổng nhân viên, phòng ban chưa có NV
- CRUD: Thêm / Đổi tên (inline edit, Enter/Esc) / Xoá (có confirm)
- Sort theo tên hoặc số nhân viên
- Phân trang (15 dòng/trang)
- **Lưu database** — dữ liệu persist qua `GET/POST/PUT/DELETE /api/departments`
- Seed tự động phòng ban từ dữ liệu import nhân viên

### 📁 Quản lý Dự án
- Sidebar danh sách dự án + panel chi tiết
- Tìm kiếm & lọc theo trạng thái
- CRUD đầy đủ: Tạo dự án, thêm thành viên, sửa, đổi tên, xoá
- Chế độ xem: Sơ đồ cây hoặc Bảng danh sách
- **Tài chính dự án**: hợp đồng, kế hoạch chi phí, thực tế, profit margin
- **Mốc hóa đơn** (SIT/UAT/PAT…): số tiền, ngày kế hoạch/thực tế, trạng thái
- **Giai đoạn dự án**: Gantt chart, tiến độ %, trạng thái on_track/at_risk/delayed
- **Clone dự án** (copy toàn bộ cấu trúc)
- **Xuất Excel** danh sách thành viên dự án

### 📥 Import Excel
- Import file `.xlsx` / `.xls`
- Tự động sync lên Spring Boot API
- Hỗ trợ tải file Excel mẫu (55 nhân viên, 6 dự án)
- Chỉ **Admin** mới có quyền import

### 📋 Lịch sử thay đổi (Audit Log)
- Tab **Lịch sử** trong sidebar — chỉ Admin mới thấy
- Bảng hiển thị lịch sử CREATE / UPDATE / DELETE / IMPORT
- Các cột: Thời gian, Loại đối tượng, Thao tác, Mã đối tượng, Tên, Người thực hiện
- Bộ lọc theo: loại đối tượng, thao tác, người thực hiện (debounce 400ms)
- Phân trang 50 bản ghi/trang
- **Không cần import Excel** — kết nối trực tiếp BE qua `GET /api/audit-logs`
- Actor lấy từ `sessionStorage` qua `X-Username` header (do `AuthInterceptor` đính kèm)

### 🧑 Hồ sơ Nhân viên
- `EmployeeProfileComponent` hiển thị thẻ thông tin chi tiết một nhân viên
- Avatar chữ cái đầu tên, chip phòng ban / cấp bậc / thâm niên
- Card quản lý trực tiếp + danh sách cấp dưới
- Timeline dự án đang tham gia và đã hoàn thành

### 🔍 Searchable Select
- Component dùng chung `app-searchable-select`
- Click-to-open, ô tìm kiếm trong dropdown
- `position: fixed` — thoát khỏi mọi `overflow: hidden`
- Tự động mở lên trên nếu không đủ chỗ phía dưới viewport

### 🌙 Dark Theme
- Toggle light/dark từ toolbar
- Tất cả component hỗ trợ `:host-context(.dark-theme)`

### 🔍 Global Search
- Tìm kiếm toàn cục: nhân viên + dự án cùng lúc
- Kết quả click → navigate thẳng đến item

---

## 📋 Cấu trúc file Excel Import

### Sheet 1: `Nhân sự`
| Cột | Trường | Mô tả |
|-----|--------|-------|
| A | ID | Mã nhân viên (duy nhất) |
| B | Họ và tên | Tên đầy đủ |
| C | Chức vụ | Vị trí công việc |
| D | Phòng ban | Phòng/bộ phận |
| E | Email | Địa chỉ email |
| F | SĐT | Số điện thoại |
| G | ID quản lý | Mã NV cấp trên (để trống = gốc) |
| H | Ngày vào làm | Định dạng `dd/MM/yyyy` |

### Sheet 2: `Dự án`
| Cột | Trường | Mô tả |
|-----|--------|-------|
| A | ID nhân viên | Mã NV tham gia |
| B | Tên dự án | Tên dự án |
| C | Vai trò | Vai trò trong dự án |
| D | Ngày bắt đầu | `dd/MM/yyyy` |
| E | Ngày kết thúc | `dd/MM/yyyy` (để trống = đang tiếp tục) |
| F | Trạng thái | `active` / `completed` / `pending` |

---

## 🏗️ Kiến trúc

```
src/app/
├── app.module.ts
├── app.component.ts/html/scss      # Shell: sidebar nav, dark theme toggle
├── app-routing.module.ts
├── models/
│   └── employee.model.ts           # Interfaces: Employee, Project, OrgNode, AuditLog
├── interceptors/
│   └── auth.interceptor.ts         # Đính kèm X-Username header vào mọi HTTP request
├── services/
│   ├── eflow-api.service.ts        # HTTP client → Spring Boot REST API
│   ├── department.service.ts       # Dept CRUD — gọi /api/departments
│   ├── auth.service.ts             # Xác thực (sessionStorage), isManager(), canEdit()
│   ├── excel-import.service.ts     # Parse Excel → sync to API
│   └── export.service.ts           # Xuất Excel (SheetJS) + PDF (jsPDF)
└── components/
    ├── excel-import/               # Upload & import Excel (Admin only)
    ├── org-chart/                  # Sơ đồ tổ chức (container + recursive node)
    ├── employee-detail/            # Panel chi tiết nhân viên
    ├── employee-management/        # CRUD nhân sự (bảng + form + export)
    ├── employee-profile/           # Hồ sơ chi tiết nhân viên (avatar, timeline dự án)
    ├── project-management/         # CRUD dự án (sidebar + panels + Gantt)
    ├── department-management/      # CRUD phòng ban (bảng + DB-backed)
    ├── audit-log/                  # Lịch sử thay đổi (Admin only, kết nối BE trực tiếp)
    ├── searchable-select/          # Reusable dropdown có tìm kiếm
    └── login/                      # Dialog đăng nhập
```

---

## 🔗 API kết nối

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8099/api'
};
```

| Service | URL |
|---------|-----|
| Frontend (Angular) | http://localhost:4200 |
| Backend (Spring Boot) | http://localhost:8099 |
| Swagger UI | http://localhost:8099/swagger-ui.html |
| H2 Console (DB) | http://localhost:8099/h2-console |

---

## 🛠️ Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| Framework | Angular 15 |
| UI Components | Angular Material |
| Icons | Google Material Icons |
| Styles | SCSS + CSS Variables |
| HTTP Client | Angular HttpClient + RxJS |
| Excel Parse/Export | SheetJS (xlsx) |
| PDF Export | jsPDF (manual table, no html2canvas) |
| Build tool | Angular CLI / Webpack |
| Auth | Stateless session (sessionStorage) |


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
- ✅ Loading overlay khi tải dữ liệu mẫu
- ✅ Loading spinner trên nút Lưu (tạo/cập nhật nhân viên)
- ✅ Loading spinner trên nút Xác nhận Xóa nhân viên

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
