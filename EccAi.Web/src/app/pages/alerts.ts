import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '../core/rule.service';
import { Alert } from '../core/models';

type Filter = 'open' | 'all' | 'acknowledged';

@Component({
  selector: 'app-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Alerts</h1>
          <p>Warnings and critical events raised by your measurement rules.</p>
        </div>
        <div class="filters">
          @for (f of filterOptions; track f.value) {
            <button class="btn" [class.btn-primary]="filter() === f.value" (click)="setFilter(f.value)">
              {{ f.label }}
            </button>
          }
        </div>
      </div>

      <div class="card table-wrap">
        @if (alerts().length === 0) {
          <div class="empty-state">No alerts to show.</div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Device / sensor</th>
                <th>Message</th>
                <th>Value</th>
                <th>Time</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (alert of alerts(); track alert.id) {
                <tr [class.ack]="alert.acknowledged">
                  <td><span class="badge" [class]="'badge-' + alert.severity">{{ alert.severity }}</span></td>
                  <td>
                    <div class="col">
                      <strong>{{ alert.sensorName }}</strong>
                      <span class="muted">{{ alert.deviceName }}</span>
                    </div>
                  </td>
                  <td>{{ alert.message }}</td>
                  <td class="mono">{{ alert.value | number: '1.2-2' }} A</td>
                  <td class="muted">{{ alert.createdAt | date: 'short' }}</td>
                  <td>
                    <span class="badge" [class]="alert.acknowledged ? 'badge-muted' : 'badge-warning'">
                      {{ alert.acknowledged ? 'acknowledged' : 'open' }}
                    </span>
                  </td>
                  <td class="actions">
                    @if (!alert.acknowledged) {
                      <button class="btn" (click)="acknowledge(alert)">Acknowledge</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .table-wrap {
        padding: 0;
        overflow-x: auto;
      }
      .filters {
        display: flex;
        gap: 0.4rem;
      }
      .col {
        display: flex;
        flex-direction: column;
      }
      .col span {
        font-size: 0.78rem;
      }
      tr.ack {
        opacity: 0.6;
      }
      .actions {
        text-align: right;
      }
    `,
  ],
})
export class Alerts {
  private readonly alertService = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly alerts = signal<Alert[]>([]);
  readonly filter = signal<Filter>('open');

  readonly filterOptions: { value: Filter; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'all', label: 'All' },
  ];

  constructor() {
    this.load();
  }

  setFilter(value: Filter): void {
    this.filter.set(value);
    this.load();
  }

  private load(): void {
    const f = this.filter();
    const acknowledged = f === 'all' ? undefined : f === 'open' ? false : true;
    this.alertService
      .list(acknowledged)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((alerts) => this.alerts.set(alerts));
  }

  acknowledge(alert: Alert): void {
    this.alertService
      .acknowledge(alert.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }
}
