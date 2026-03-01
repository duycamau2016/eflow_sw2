/**
 * Script tạo file Excel mẫu: 55 nhân viên, 6 dự án
 * Chạy: node generate-sample.js
 */
const XLSX = require('xlsx');
const path = require('path');

// -------------------------------------------------------
// Dữ liệu gốc
// -------------------------------------------------------
const departments = ['Kỹ thuật', 'Kinh doanh', 'Nhân sự', 'Tài chính', 'Marketing', 'Vận hành', 'Pháp lý'];
const positions = {
  0: ['Giám đốc điều hành (CEO)'],
  1: ['Giám đốc kỹ thuật (CTO)', 'Giám đốc kinh doanh (CSO)', 'Giám đốc tài chính (CFO)', 'Giám đốc nhân sự (CHRO)'],
  2: ['Trưởng phòng Kỹ thuật', 'Trưởng phòng Backend', 'Trưởng phòng Frontend', 'Trưởng phòng Kinh doanh', 'Trưởng phòng Marketing', 'Trưởng phòng Tài chính', 'Trưởng phòng Nhân sự', 'Trưởng phòng Vận hành', 'Trưởng phòng Pháp lý'],
  3: ['Senior Developer', 'Senior Designer', 'Senior BA', 'Kế toán trưởng', 'Chuyên viên kinh doanh cấp cao', 'Chuyên viên nhân sự cấp cao', 'Chuyên viên marketing cấp cao'],
  4: ['Developer', 'Designer', 'BA', 'Tester', 'Kế toán', 'Nhân viên kinh doanh', 'Nhân viên nhân sự', 'Nhân viên marketing', 'Nhân viên vận hành'],
};

const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const middleNames = ['Văn', 'Thị', 'Đức', 'Minh', 'Quốc', 'Hữu', 'Thành', 'Bảo', 'Xuân', 'Thu'];
const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Hà', 'Hải', 'Hùng', 'Khánh', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Ngân', 'Nhung', 'Phúc', 'Quân', 'Sơn', 'Thắng', 'Thảo', 'Thịnh', 'Thu', 'Trang', 'Trung', 'Tuấn', 'Tùng', 'Vy', 'Yến'];

const projectNames = [
  'Hệ thống ERP Nội bộ',
  'Ứng dụng Di động eFlow',
  'Nền tảng Thương mại Điện tử',
  'Dự án Chuyển đổi Số',
  'Hệ thống Quản lý Kho',
  'Dự án Mở rộng Thị trường',
];

const projectRoles = ['Trưởng dự án', 'Phó dự án', 'Lập trình viên', 'Designer', 'Tester', 'BA', 'DevOps', 'Tư vấn'];
const projectStatuses = ['active', 'completed', 'pending'];

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
let nameCounter = 0;
function randomName() {
  nameCounter++;
  const fn = firstNames[nameCounter % firstNames.length];
  const mn = middleNames[nameCounter % middleNames.length];
  const ln = lastNames[nameCounter % lastNames.length];
  return `${fn} ${mn} ${ln}`;
}

function randomPhone() {
  const prefixes = ['090', '091', '093', '094', '096', '097', '098', '032', '033', '034', '035', '036', '070', '079'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  return p + String(Math.floor(Math.random() * 9000000) + 1000000);
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

function emailFrom(name, id) {
  const clean = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi,'d').toLowerCase().replace(/\s+/g,'.');
  return `${clean}.${id.toLowerCase()}@eflow.vn`;
}

// -------------------------------------------------------
// Xây dựng cấu trúc nhân viên
// -------------------------------------------------------
const employees = [];
let idCounter = 1;

function makeId() { return `EMP${String(idCounter++).padStart(3,'0')}`; }

// Tầng 0: CEO (1 người)
const ceo = { id: makeId(), name: randomName(), position: 'Giám đốc điều hành (CEO)', department: 'Ban Giám đốc', managerId: '', level: 0 };
employees.push(ceo);

// Tầng 1: C-level (4 người)
const cLevel = [
  { dept: 'Kỹ thuật',  pos: 'Giám đốc kỹ thuật (CTO)' },
  { dept: 'Kinh doanh',pos: 'Giám đốc kinh doanh (CSO)' },
  { dept: 'Tài chính', pos: 'Giám đốc tài chính (CFO)' },
  { dept: 'Nhân sự',   pos: 'Giám đốc nhân sự (CHRO)' },
];
const level1 = cLevel.map(c => {
  const e = { id: makeId(), name: randomName(), position: c.pos, department: c.dept, managerId: ceo.id };
  employees.push(e);
  return e;
});

// Tầng 2: Trưởng phòng (~10 người, phân bổ cho từng giám đốc)
const deptHeads = [
  { parent: level1[0], depts: [{ dept:'Kỹ thuật', pos:'Trưởng phòng Backend' }, { dept:'Kỹ thuật', pos:'Trưởng phòng Frontend' }, { dept:'Vận hành', pos:'Trưởng phòng Vận hành' }] },
  { parent: level1[1], depts: [{ dept:'Kinh doanh', pos:'Trưởng phòng Kinh doanh' }, { dept:'Marketing', pos:'Trưởng phòng Marketing' }] },
  { parent: level1[2], depts: [{ dept:'Tài chính', pos:'Trưởng phòng Tài chính' }, { dept:'Pháp lý', pos:'Trưởng phòng Pháp lý' }] },
  { parent: level1[3], depts: [{ dept:'Nhân sự', pos:'Trưởng phòng Nhân sự' }, { dept:'Đào tạo', pos:'Trưởng phòng Đào tạo' }] },
];
const level2 = [];
deptHeads.forEach(g => {
  g.depts.forEach(d => {
    const e = { id: makeId(), name: randomName(), position: d.pos, department: d.dept, managerId: g.parent.id };
    employees.push(e);
    level2.push(e);
  });
});

// Tầng 3: Senior (khoảng 13 người)
const seniorDefs = [
  { parent: level2[0],  pos: 'Senior Backend Developer',  dept: 'Kỹ thuật' },
  { parent: level2[0],  pos: 'Senior Backend Developer',  dept: 'Kỹ thuật' },
  { parent: level2[1],  pos: 'Senior Frontend Developer', dept: 'Kỹ thuật' },
  { parent: level2[1],  pos: 'Senior UI/UX Designer',     dept: 'Kỹ thuật' },
  { parent: level2[2],  pos: 'Senior DevOps Engineer',    dept: 'Vận hành' },
  { parent: level2[3],  pos: 'Senior Sales Executive',    dept: 'Kinh doanh' },
  { parent: level2[3],  pos: 'Senior Account Manager',   dept: 'Kinh doanh' },
  { parent: level2[4],  pos: 'Senior Marketing Specialist', dept: 'Marketing' },
  { parent: level2[4],  pos: 'Senior Content Creator',   dept: 'Marketing' },
  { parent: level2[5],  pos: 'Kế toán trưởng',           dept: 'Tài chính' },
  { parent: level2[6],  pos: 'Senior Legal Counsel',      dept: 'Pháp lý' },
  { parent: level2[7],  pos: 'Senior HR Specialist',      dept: 'Nhân sự' },
  { parent: level2[8],  pos: 'Senior Trainer',            dept: 'Đào tạo' },
];
const level3 = seniorDefs.map(d => {
  const e = { id: makeId(), name: randomName(), position: d.pos, department: d.dept, managerId: d.parent.id };
  employees.push(e);
  return e;
});

// Tầng 4: Nhân viên (~27 người để tổng đạt 55)
const juniorsNeeded = 55 - employees.length; // = 55 - 1 - 4 - 9 - 13 = 28
const juniorDefs = [
  { parent: level3[0],  pos: 'Backend Developer', dept: 'Kỹ thuật', count: 2 },
  { parent: level3[1],  pos: 'Backend Developer', dept: 'Kỹ thuật', count: 2 },
  { parent: level3[2],  pos: 'Frontend Developer',dept: 'Kỹ thuật', count: 2 },
  { parent: level3[3],  pos: 'UI/UX Designer',    dept: 'Kỹ thuật', count: 2 },
  { parent: level3[4],  pos: 'DevOps Engineer',   dept: 'Vận hành', count: 2 },
  { parent: level3[5],  pos: 'Sales Executive',   dept: 'Kinh doanh', count: 3 },
  { parent: level3[6],  pos: 'Account Manager',   dept: 'Kinh doanh', count: 2 },
  { parent: level3[7],  pos: 'Marketing Specialist', dept: 'Marketing', count: 3 },
  { parent: level3[8],  pos: 'Content Creator',   dept: 'Marketing', count: 2 },
  { parent: level3[9],  pos: 'Kế toán',           dept: 'Tài chính', count: 2 },
  { parent: level3[10], pos: 'Legal Associate',   dept: 'Pháp lý', count: 2 },
  { parent: level3[11], pos: 'HR Specialist',     dept: 'Nhân sự', count: 2 },
  { parent: level3[12], pos: 'Trainer',           dept: 'Đào tạo', count: 2 },
];

juniorDefs.forEach(d => {
  for (let i = 0; i < d.count; i++) {
    const e = { id: makeId(), name: randomName(), position: d.pos, department: d.dept, managerId: d.parent.id };
    employees.push(e);
  }
});

console.log(`Tổng nhân viên: ${employees.length}`);

// -------------------------------------------------------
// Sheet "Nhân sự"
// -------------------------------------------------------
const joinStart = new Date(2015, 0, 1);
const joinEnd   = new Date(2024, 11, 31);

const hrRows = [
  ['ID', 'Họ và Tên', 'Chức vụ', 'Phòng ban', 'Email', 'Số điện thoại', 'ID Quản lý', 'Ngày vào làm'],
  ...employees.map(e => [
    e.id,
    e.name,
    e.position,
    e.department,
    emailFrom(e.name, e.id),
    randomPhone(),
    e.managerId || '',
    randomDate(joinStart, joinEnd),
  ])
];

// -------------------------------------------------------
// Sheet "Dự án" — mỗi dự án gán cho nhiều nhân viên
// -------------------------------------------------------
const allProjectIds = [1, 2, 3, 4, 5, 6];

// Gán dự án cho nhân viên (trừ CEO và C-level)
const eligibleIds = employees.filter(e => e.managerId).map(e => e.id);

// Shuffle
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

const projectRows = [
  ['ID Nhân viên', 'Tên dự án', 'Vai trò', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái'],
];

const projStart = new Date(2023, 0, 1);
const projEnd   = new Date(2025, 11, 31);
const statusCycle = ['active', 'active', 'completed', 'pending', 'active', 'completed'];

// Đảm bảo mỗi dự án có ít nhất 5 nhân viên, tổng ~120 dòng
const shuffled = shuffle([...eligibleIds]);
shuffled.forEach((empId, idx) => {
  // Mỗi nhân viên tham gia 2 dự án ngẫu nhiên
  const p1 = allProjectIds[idx % 6];
  const p2 = allProjectIds[(idx + 3) % 6];
  const uniqueProjs = [...new Set([p1, p2])];
  uniqueProjs.forEach(pIdx => {
    const pName = projectNames[pIdx - 1];
    const role  = projectRoles[idx % projectRoles.length];
    const status = statusCycle[pIdx - 1];
    const start = randomDate(projStart, new Date(2024, 5, 30));
    const end   = status === 'completed' ? randomDate(new Date(2024, 6, 1), projEnd) :
                  status === 'pending'   ? randomDate(new Date(2025, 0, 1), projEnd) : '';
    projectRows.push([empId, pName, role, start, end, status]);
  });
});

// -------------------------------------------------------
// Xuất file
// -------------------------------------------------------
const wb = XLSX.utils.book_new();

const wsHR = XLSX.utils.aoa_to_sheet(hrRows);
// Đặt độ rộng cột
wsHR['!cols'] = [10, 25, 30, 20, 35, 16, 10, 14].map(w => ({ wch: w }));
XLSX.utils.book_append_sheet(wb, wsHR, 'Nhân sự');

const wsProj = XLSX.utils.aoa_to_sheet(projectRows);
wsProj['!cols'] = [10, 35, 25, 14, 14, 12].map(w => ({ wch: w }));
XLSX.utils.book_append_sheet(wb, wsProj, 'Dự án');

const outPath = path.join(__dirname, 'sample-data-55emp-6proj.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`✅ Đã tạo file: ${outPath}`);
console.log(`   - Sheet "Nhân sự": ${employees.length} nhân viên`);
console.log(`   - Sheet "Dự án"  : ${projectRows.length - 1} dòng (6 dự án)`);
