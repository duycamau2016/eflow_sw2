import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DepartmentApiDTO, EFlowApiService } from './eflow-api.service';

@Injectable({ providedIn: 'root' })
export class DepartmentService {

  private _subject = new BehaviorSubject<DepartmentApiDTO[]>([]);

  /** Observable — components subscribe để nhận update */
  readonly depts$ = this._subject.asObservable();

  constructor(private api: EFlowApiService) {
    this.load();
  }

  /** Tải danh sách phòng ban từ API, đẩy vào Subject */
  load(): void {
    this.api.getAllDepartments().subscribe({
      next: list => this._subject.next(list),
      error: () => { /* giữ nguyên list hiện tại nếu lỗi mạng */ }
    });
  }

  /** Lấy danh sách hiện tại (snapshot) */
  getAll(): DepartmentApiDTO[] {
    return this._subject.getValue();
  }

  /**
   * Seed phòng ban từ danh sách nhân viên.
   * Gọi sau khi allEmployees được load — chỉ thêm những phòng ban chưa có trong DB.
   */
  seedFromEmployees(names: string[]): void {
    if (!names.length) return;
    this.api.seedDepartments(names).subscribe({
      next: list => this._subject.next(list),
      error: () => {}
    });
  }

  /** Thêm phòng ban — trả Observable để component subscribe và bắt lỗi */
  add(name: string): Observable<DepartmentApiDTO> {
    return this.api.createDepartment(name).pipe(
      tap(() => this.load())
    );
  }

  /** Đổi tên phòng ban */
  rename(id: number, newName: string): Observable<DepartmentApiDTO> {
    return this.api.renameDepartment(id, newName).pipe(
      tap(() => this.load())
    );
  }

  /** Xóa phòng ban */
  remove(id: number): Observable<void> {
    return this.api.deleteDepartment(id).pipe(
      tap(() => this.load())
    );
  }
}
