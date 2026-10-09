import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { interval, startWith, switchMap } from 'rxjs';
import { DeviceService } from '../core/device.service';
import { Device, DeviceError, MeasurementPoint, Sensor } from '../core/models';
import { TrendChart } from '../shared/trend-chart';

interface SensorForm {
  id: number | null;
  key: string;
  name: string;
  unit: string;
  maxExpected: number | null;
}

const emptyForm: SensorForm = { id: null, key: '', name: '', unit: 'A', maxExpected: null };

@Component({
  selector: 'app-device-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipe, DecimalPipe, TrendChart],
  template: `
    @if (device(); as d) {
      <div class="page">
        <div class="page-header">
          <div>
            <a routerLink="/devices" class="link-btn">← Devices</a>
            <h1>{{ d.name }}</h1>
            <p class="muted mono">{{ d.hardwareId }}</p>
          </div>
          <span class="badge" [class]="d.isOnline ? 'badge-success' : 'badge-muted'">
            {{ d.isOnline ? 'online' : 'offline' }}
          </span>
        </div>

        <section class="card">
          <div class="card-title">
            <h2>Sensors</h2>
            <button class="btn" (click)="startAdd()">Add sensor</button>
          </div>

          <div class="sensor-grid">
            @for (sensor of d.sensors; track sensor.id) {
              <button class="sensor-card" [class.selected]="sensor.id === selectedId()" (click)="select(sensor.id)">
                <div class="sensor-head">
                  <span class="mono muted">{{ sensor.key }}</span>
                  <span class="sensor-actions">
                    <span class="link-btn" (click)="startEdit(sensor, $event)">edit</span>
                    <span class="link-btn danger" (click)="removeSensor(sensor, $event)">delete</span>
                  </span>
                </div>
                <strong>{{ sensor.name }}</strong>
                <div class="sensor-value">
                  {{ sensor.latestValue !== null ? (sensor.latestValue | number: '1.2-2') : '—' }}
                  <small>{{ sensor.unit }}</small>
                </div>
                <small class="muted">
                  {{ sensor.latestTimestamp ? (sensor.latestTimestamp | date: 'mediumTime') : 'no readings' }}
                </small>
              </button>
            } @empty {
              <div class="empty-state">No sensors configured. Add one to start collecting current readings.</div>
            }
          </div>
        </section>

        @if (formOpen()) {
          <section class="card">
            <div class="card-title">
              <h2>{{ form.id ? 'Edit' : 'Add' }} sensor</h2>
            </div>
            <div class="form-row">
              <div class="field">
                <label>Channel key</label>
                <input [(ngModel)]="form.key" [disabled]="form.id !== null" placeholder="ch1" />
              </div>
              <div class="field">
                <label>Display name</label>
                <input [(ngModel)]="form.name" placeholder="Main Line" />
              </div>
              <div class="field">
                <label>Unit</label>
                <input [(ngModel)]="form.unit" placeholder="A" />
              </div>
              <div class="field">
                <label>Max expected</label>
                <input type="number" [(ngModel)]="form.maxExpected" placeholder="30" />
              </div>
            </div>
            @if (formError()) {
              <p class="error-text">{{ formError() }}</p>
            }
            <div class="row">
              <span class="spacer"></span>
              <button class="btn" (click)="formOpen.set(false)">Cancel</button>
              <button class="btn btn-primary" (click)="saveSensor()" [disabled]="saving()">Save</button>
            </div>
          </section>
        }

        <div class="grid grid-2">
          <section class="card">
            <div class="card-title">
              <h2>Measurement trend</h2>
              @if (selectedSensor(); as s) {
                <span class="badge badge-muted">{{ s.name }} · {{ s.unit }}</span>
              }
            </div>
            <div class="chart-box">
              <app-trend-chart [points]="measurements()" [unit]="selectedSensor()?.unit ?? 'A'" />
            </div>
          </section>

          <section class="card">
            <div class="card-title">
              <h2>Device errors</h2>
              <span class="badge badge-muted">{{ errors().length }}</span>
            </div>
            @if (errors().length === 0) {
              <div class="empty-state">No errors reported by this device.</div>
            } @else {
              <ul class="error-list">
                @for (error of errors(); track error.id) {
                  <li [class.ack]="error.acknowledged">
                    <span class="badge" [class]="'badge-' + error.severity">{{ error.severity }}</span>
                    <div class="error-body">
                      <strong class="mono">{{ error.code }}</strong>
                      <span>{{ error.message }}</span>
                      <small class="muted">{{ error.timestamp | date: 'short' }}</small>
                    </div>
                    @if (!error.acknowledged) {
                      <button class="btn btn-ghost" (click)="ackError(error)">Ack</button>
                    }
                  </li>
                }
              </ul>
            }
          </section>
        </div>
      </div>
    } @else {
      <div class="card empty-state">Loading device…</div>
    }
  `,
  styles: [
    `
      .sensor-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
      }
      .sensor-card {
        text-align: left;
        background: var(--bg-panel);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-sm);
        padding: 0.9rem;
        color: var(--text);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-family: inherit;
      }
      .sensor-card:hover {
        border-color: var(--border);
      }
      .sensor-card.selected {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.2);
      }
      .sensor-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
      }
      .sensor-actions {
        display: flex;
        gap: 0.6rem;
      }
      .link-btn.danger {
        color: var(--critical);
      }
      .sensor-value {
        font-size: 1.6rem;
        font-weight: 700;
      }
      .sensor-value small {
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-muted);
      }
      .chart-box {
        height: 220px;
      }
      .error-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .error-list li {
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
      }
      .error-list li.ack {
        opacity: 0.55;
      }
      .error-body {
        display: flex;
        flex-direction: column;
      }
      .error-body small {
        font-size: 0.75rem;
      }
    `,
  ],
})
export class DeviceDetail {
  private readonly deviceService = inject(DeviceService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly device = signal<Device | null>(null);
  readonly selectedId = signal<number | null>(null);
  readonly measurements = signal<MeasurementPoint[]>([]);
  readonly errors = signal<DeviceError[]>([]);
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  form: SensorForm = { ...emptyForm };

  private readonly deviceId = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.deviceService.get(this.deviceId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (device) => {
          this.device.set(device);
          if (this.selectedId() === null && device.sensors.length > 0) {
            this.select(device.sensors[0].id);
          } else if (this.selectedId() !== null) {
            this.loadMeasurements();
          }
        },
        error: () => undefined,
      });

    this.loadErrors();
  }

  selectedSensor(): Sensor | undefined {
    return this.device()?.sensors.find((s) => s.id === this.selectedId());
  }

  select(id: number): void {
    this.selectedId.set(id);
    this.loadMeasurements();
  }

  private refreshDevice(): void {
    this.deviceService
      .get(this.deviceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((device) => this.device.set(device));
  }

  private loadMeasurements(): void {
    const id = this.selectedId();
    if (id === null) {
      return;
    }
    this.deviceService
      .getMeasurements(id, 120)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((points) => this.measurements.set(points));
  }

  private loadErrors(): void {
    this.deviceService
      .getErrors(this.deviceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((errors) => this.errors.set(errors));
  }

  startAdd(): void {
    this.form = { ...emptyForm };
    this.formError.set(null);
    this.formOpen.set(true);
  }

  startEdit(sensor: Sensor, event: Event): void {
    event.stopPropagation();
    this.form = {
      id: sensor.id,
      key: sensor.key,
      name: sensor.name,
      unit: sensor.unit,
      maxExpected: sensor.maxExpected,
    };
    this.formError.set(null);
    this.formOpen.set(true);
  }

  saveSensor(): void {
    if (!this.form.name) {
      this.formError.set('Name is required.');
      return;
    }
    if (this.form.id === null && !this.form.key) {
      this.formError.set('Channel key is required.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const done = {
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.refreshDevice();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.formError.set(err.error?.message ?? 'Could not save sensor.');
      },
    };

    if (this.form.id === null) {
      this.deviceService
        .createSensor(this.deviceId, {
          key: this.form.key,
          name: this.form.name,
          unit: this.form.unit || 'A',
          maxExpected: this.form.maxExpected,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(done);
    } else {
      this.deviceService
        .updateSensor(this.form.id, {
          name: this.form.name,
          unit: this.form.unit || 'A',
          maxExpected: this.form.maxExpected,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(done);
    }
  }

  removeSensor(sensor: Sensor, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Delete sensor "${sensor.name}"?`)) {
      return;
    }
    this.deviceService
      .deleteSensor(sensor.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.selectedId() === sensor.id) {
          this.selectedId.set(null);
          this.measurements.set([]);
        }
        this.refreshDevice();
      });
  }

  ackError(error: DeviceError): void {
    this.deviceService
      .acknowledgeError(error.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadErrors());
  }
}
