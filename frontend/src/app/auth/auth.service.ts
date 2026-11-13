import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

const TOKEN_KEY = 'cardmaker.token';

interface AuthResponse {
  token: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly token = signal<string | null>(readStoredToken());

  /** The logged-in username, or null when logged out. */
  readonly username = computed(() => usernameFromToken(this.token()));
  readonly loggedIn = computed(() => this.username() !== null);

  getToken(): string | null {
    return this.token();
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { username, password }).pipe(tap(r => this.setToken(r.token)));
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', { username, password }).pipe(tap(r => this.setToken(r.token)));
  }

  logout() {
    this.setToken(null);
    this.router.navigateByUrl('/');
  }

  private setToken(token: string | null) {
    this.token.set(token);
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage can be blocked (e.g. private browsing); the login still works until the tab closes.
    }
  }
}

/** Adds the login token to API requests, and logs out if the server says the token is no longer valid. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const request = token && req.url.startsWith('/api/') ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request).pipe(
    tap({
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401 && token) auth.logout();
      },
    }),
  );
};

/** Turns an HTTP error into a message to show the user. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (typeof err.error?.message === 'string') return err.error.message;
    if (err.status === 0 || err.status === 504) return 'Could not reach the server. Is the backend running?';
  }
  return 'Something went wrong. Please try again.';
}

function readStoredToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return usernameFromToken(token) ? token : null;
  } catch {
    return null;
  }
}

/** Reads the username from a JWT, or null if it is missing, malformed or expired. */
function usernameFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return typeof payload.username === 'string' ? payload.username : null;
  } catch {
    return null;
  }
}
