import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Thêm header `X-Username` vào mọi HTTP request nếu user đã đăng nhập.
 * BE sẽ đọc header này để ghi Audit Log.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const user = this.authService.currentUser;
    if (user?.username) {
      const cloned = req.clone({
        headers: req.headers.set('X-Username', user.username)
      });
      return next.handle(cloned);
    }
    return next.handle(req);
  }
}
