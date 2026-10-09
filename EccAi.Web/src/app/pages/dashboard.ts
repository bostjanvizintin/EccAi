import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, interval, of, startWith, switchMap } from 'rxjs';
import { DeviceService } from '../core/device.service';
import { DashboardSummary } from '../core/models';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Live overview of your paired microcontrollers and current readings.</p>
        </div>
        <span class="badge badge-muted">Auto-refresh · 5s</span>
      </div>

      @if (summary(); as s) {
        <div class="grid grid-stats">
          <div class="stat">
            <span class="stat-label">Devices</span>
            <span class="stat-value">{{ s.deviceCount }}</span>
            <span class="muted">{{ s.onlineCount }} online</span>
          </div>
          <div class="stat">
            <span class="stat-label">Sensors</span>
            <span class="stat-value">{{ s.sensorCount }}</span>
            <span class="muted">current channels</span>
          </div>
          <div class="stat" [class.is-critical]="s.openAlertCount > 0">
            <span class="stat-label">Open alerts</span>
            <span class="stat-value">{{ s.openAlertCount }}</span>
            <span class="muted">from measurement rules</span>
          </div>
          <div class="stat" [class.is-warning]="s.unacknowledgedErrorCount > 0">
            <span class="stat-label">Device errors</span>
            <span class="stat-value">{{ s.unacknowledgedErrorCount }}</span>
            <span class="muted">unacknowledged</span>
          </div>
        </div>

        <div class="grid grid-2">
          <section class="card">
            <div class="card-title">
              <h2>Devices</h2>
              <a routerLink="/devices" class="link-btn">Manage</a>
            </div>
            @if (s.devices.length === 0) {
              <div class="empty-state">No devices paired yet.</div>
            } @else {
              <div class="device-list">
                @for (device of s.devices; track device.id) {
                  <a class="device-row" [routerLink]="['/devices', device.id]">
                    <span class="dot" [class.online]="device.isOnline" [class.offline]="!device.isOnline"></span>
                    <div class="device-main">
                      <strong>{{ device.name }}</strong>
                      <span class="muted mono">{{ device.hardwareId }}</span>
                    </div>
                    <div class="readings">
                      @for (sensor of device.sensors.slice(0, 3); track sensor.id) {
                        <span class="reading">
                          <span class="muted">{{ sensor.name }}</span>
                          <strong>{{ sensor.latestValue !== null ? (sensor.latestValue | number: '1.2-2') : '—' }} {{ sensor.unit }}</strong>
                        </span>
                      }
                    </div>
                  </a>
                }
              </div>
            }
          </section>

          <section class="card">
            <div class="card-title">
              <h2>Open alerts</h2>
              <a routerLink="/alerts" class="link-btn">View all</a>
            </div>
            @if (s.openAlerts.length === 0) {
              <div class="empty-state">No open alerts. All measurements within rules.</div>
            } @else {
              <ul class="alert-list">
                @for (alert of s.openAlerts; track alert.id) {
                  <li>
                    <span class="badge" [class]="'badge-' + alert.severity">{{ alert.severity }}</span>
                    <div class="alert-body">
                      <strong>{{ alert.message }}</strong>
                      <span class="muted">
                        {{ alert.deviceName }} · {{ alert.sensorName }} ·
                        {{ alert.value | number: '1.2-2' }} A · {{ alert.createdAt | date: 'short' }}
                      </span>
                    </div>
                  </li>
                }
              </ul>
            }
          </section>
        </div>
      } @else if (error()) {
        <div class="card empty-state">
          Could not load dashboard. Make sure the API is running on http://localhost:5000.
        </div>
      } @else {
        <div class="card empty-state">Loading…</div>
      }
    </div>
  `,
  styles: [
    `
      .device-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .device-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem;
        border-radius: var(--radius-sm);
        color: var(--text);
        border: 1px solid transparent;
      }
      .device-row:hover {
        background: var(--bg-panel);
        border-color: var(--border-soft);
      }
      .device-main {
        display: flex;
        flex-direction: column;
        min-width: 140px;
      }
      .readings {
        display: flex;
        gap: 1rem;
        margin-left: auto;
        flex-wrap: wrap;
      }
      .reading {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-size: 0.82rem;
      }
      .alert-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .alert-list li {
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
      }
      .alert-body {
        display: flex;
        flex-direction: column;
      }
      .alert-body span {
        font-size: 0.78rem;
      }
    `,
  ],
})
export class Dashboard {
  private readonly devices = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly summary = signal<DashboardSummary | null>(null);
  readonly error = signal(false);

  constructor() {
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.devices.getDashboard().pipe(catchError(() => {
          this.error.set(true);
          return of(null);
        }))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        if (data) {
          this.error.set(false);
          this.summary.set(data);
        }
      });
  }
}
