import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">E</span>
          <div>
            <strong>EccAi</strong>
            <div class="brand-sub">Current monitoring</div>
          </div>
        </div>

        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/devices" routerLinkActive="active">Devices</a>
          <a routerLink="/rules" routerLinkActive="active">Rules</a>
          <a routerLink="/alerts" routerLinkActive="active">Alerts</a>
        </nav>

        <div class="sidebar-footer">
          <div class="user">
            <div class="avatar">{{ initials() }}</div>
            <div class="user-meta">
              <strong>{{ auth.user()?.name }}</strong>
              <span>{{ auth.user()?.email }}</span>
            </div>
          </div>
          <button class="btn btn-ghost" (click)="logout()">Sign out</button>
        </div>
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        display: grid;
        grid-template-columns: 250px 1fr;
        min-height: 100vh;
      }
      .sidebar {
        background: var(--bg-elevated);
        border-right: 1px solid var(--border-soft);
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        position: sticky;
        top: 0;
        height: 100vh;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }
      .brand-mark {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: linear-gradient(140deg, var(--accent), #7a5cff);
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 1.1rem;
      }
      .brand-sub {
        color: var(--text-muted);
        font-size: 0.72rem;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
      }
      nav a {
        color: var(--text-muted);
        padding: 0.6rem 0.75rem;
        border-radius: var(--radius-sm);
        font-weight: 500;
      }
      nav a:hover {
        background: var(--bg-panel);
        color: var(--text);
      }
      nav a.active {
        background: rgba(79, 140, 255, 0.15);
        color: var(--text);
      }
      .sidebar-footer {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .user {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      .avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--bg-panel);
        display: grid;
        place-items: center;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--accent);
      }
      .user-meta {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .user-meta strong {
        font-size: 0.85rem;
      }
      .user-meta span {
        font-size: 0.72rem;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .content {
        padding: 2rem;
        max-width: 1200px;
        width: 100%;
      }
      @media (max-width: 820px) {
        .shell {
          grid-template-columns: 1fr;
        }
        .sidebar {
          position: static;
          height: auto;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
        }
        nav {
          flex-direction: row;
          flex: 1 1 100%;
        }
        .content {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class Shell {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  initials(): string {
    const name = this.auth.user()?.name ?? '?';
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
