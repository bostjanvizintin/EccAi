import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthUser, LoginResponse } from './models';

const TOKEN_KEY = 'eccai.token';
const USER_KEY = 'eccai.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthUser | null>(this.readStoredUser());
  readonly isAuthenticated = computed(() => this.user() !== null && this.token !== null);

  private token: string | null = localStorage.getItem(TOKEN_KEY);

  getToken(): string | null {
    return this.token;
  }

  async login(email: string, name?: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>('/api/auth/login', { email, name }),
    );
    this.token = response.token;
    const user: AuthUser = { id: response.id, email: response.email, name: response.name };
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } catch {
      // ignore network errors during logout
    }
    this.clear();
  }

  clear(): void {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
