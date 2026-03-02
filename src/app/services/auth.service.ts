import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  username: string;
  role: string;
}

interface LoginResponse {
  success: boolean;
  username: string;
  role: string;
  message: string;
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
            const user: AuthUser = { username: res.username, role: res.role };
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

  private loadFromStorage(): AuthUser | null {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
}
