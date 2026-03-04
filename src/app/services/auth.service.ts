import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  username:   string;
  role:       string;
  /** Phòng ban quản lý — chỉ có với role MANAGER */
  department: string | null;
}

interface LoginResponse {
  success:    boolean;
  username:   string;
  role:       string;
  department: string | null;
  message:    string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'eflow_auth_user';
  private userSubject = new BehaviorSubject<AuthUser | null>(this.loadFromStorage());

  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap(res => {
          if (res.success) {
            const user: AuthUser = {
              username:   res.username,
              role:       res.role,
              department: res.department ?? null
            };
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
            this.userSubject.next(user);
          }
        })
      );
  }

  logout(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.userSubject.next(null);
  }

  get currentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  isLoggedIn(): boolean {
    return this.userSubject.value !== null;
  }

  isAdmin(): boolean {
    return this.isLoggedIn() && this.userSubject.value?.role === 'ADMIN';
  }

  isManager(): boolean {
    return this.isLoggedIn() && this.userSubject.value?.role === 'MANAGER';
  }

  /** Admin hoặc Manager đều có quyền chỉnh sửa (ở phạm vi của mình) */
  canEdit(): boolean {
    return this.isAdmin() || this.isManager();
  }

  /** Phòng ban mà Manager được phép quản lý (null với Admin) */
  get managerDepartment(): string | null {
    return this.userSubject.value?.department ?? null;
  }

  private loadFromStorage(): AuthUser | null {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
}

