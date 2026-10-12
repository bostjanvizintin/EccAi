import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="login-page">
      <form class="card login-card" (ngSubmit)="submit()">
        <div class="login-brand">
          <span class="brand-mark">E</span>
          <div>
            <h1>EccAi</h1>
            <p class="muted">Current monitoring &amp; alerting</p>
          </div>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" [(ngModel)]="email" required
            placeholder="demo@eccai.local" autocomplete="email" />
        </div>

        <div class="field">
          <label for="name">Name</label>
          <input id="name" name="name" type="text" [(ngModel)]="name" placeholder="Demo User" />
        </div>

        @if (error()) {
          <p class="error-text">{{ error() }}</p>
        }

        <button class="btn btn-primary full" type="submit" [disabled]="loading()">
          {{ loading() ? 'Signing in…' : 'Sign in' }}
        </button>

        <p class="muted hint">
          This POC creates an account on first sign-in. Use any email, or the seeded
          <strong>demo&#64;eccai.local</strong>.
        </p>
      </form>
    </div>
  `,
  styles: [
    `
      .login-page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: radial-gradient(circle at 20% 20%, rgba(79, 140, 255, 0.18), transparent 45%),
          radial-gradient(circle at 80% 80%, rgba(122, 92, 255, 0.16), transparent 45%), var(--bg);
      }
      .login-card {
        width: 100%;
        max-width: 400px;
      }
      .login-brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }
      .brand-mark {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: linear-gradient(140deg, var(--accent), #7a5cff);
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 1.3rem;
      }
      .login-brand h1 {
        margin: 0;
      }
      .login-brand p {
        margin: 0;
        font-size: 0.8rem;
      }
      .full {
        width: 100%;
        justify-content: center;
        margin-top: 0.5rem;
      }
      .hint {
        font-size: 0.78rem;
        margin: 1rem 0 0;
      }
    `,
  ],
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = 'demo@eccai.local';
  name = 'Demo User';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (!this.email) {
      this.error.set('Email is required.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email, this.name || undefined);
      await this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Sign in failed. Is the API running?');
    } finally {
      this.loading.set(false);
    }
  }
}
