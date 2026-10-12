import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DeviceService } from '../core/device.service';
import { Device, Rule, RuleInput, RuleOperator, Severity, Sensor } from '../core/models';
import { RuleService } from '../core/rule.service';

interface RuleForm {
  id: number | null;
  sensorId: number | null;
  operator: RuleOperator;
  threshold: number | null;
  severity: Severity;
  message: string;
  enabled: boolean;
  cooldownMinutes: number;
}

const emptyForm: RuleForm = {
  id: null,
  sensorId: null,
  operator: 'gt',
  threshold: null,
  severity: 'warning',
  message: '',
  enabled: true,
  cooldownMinutes: 10,
};

const operatorLabels: Record<RuleOperator, string> = {
  gt: 'is above',
  gte: 'is at or above',
  lt: 'is below',
  lte: 'is at or below',
};

@Component({
  selector: 'app-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Measurement rules</h1>
          <p>Get alerted when a current reading crosses a threshold.</p>
        </div>
        <button class="btn btn-primary" (click)="startAdd()">New rule</button>
      </div>

      @if (formOpen()) {
        <section class="card">
          <div class="card-title">
            <h2>{{ form.id ? 'Edit rule' : 'New rule' }}</h2>
          </div>

          <div class="form-row">
            <div class="field">
              <label>Sensor</label>
              <select [(ngModel)]="form.sensorId">
                <option [ngValue]="null" disabled>Select a sensor…</option>
                @for (option of sensorOptions(); track option.id) {
                  <option [ngValue]="option.id">{{ option.label }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Condition</label>
              <select [(ngModel)]="form.operator">
                @for (op of operators; track op) {
                  <option [ngValue]="op">{{ operatorLabel(op) }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Threshold (A)</label>
              <input type="number" [(ngModel)]="form.threshold" placeholder="20" />
            </div>
          </div>

          <div class="form-row">
            <div class="field">
              <label>Severity</label>
              <select [(ngModel)]="form.severity">
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div class="field">
              <label>Cooldown (minutes)</label>
              <input type="number" [(ngModel)]="form.cooldownMinutes" min="0" />
            </div>
            <div class="field">
              <label>Enabled</label>
              <select [(ngModel)]="form.enabled">
                <option [ngValue]="true">Yes</option>
                <option [ngValue]="false">No</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label>Alert message</label>
            <input [(ngModel)]="form.message" placeholder="Main line current above 20 A" />
          </div>

          @if (formError()) {
            <p class="error-text">{{ formError() }}</p>
          }

          <div class="row">
            <span class="spacer"></span>
            <button class="btn" (click)="formOpen.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="saving()">Save rule</button>
          </div>
        </section>
      }

      <div class="card table-wrap">
        @if (rules().length === 0) {
          <div class="empty-state">No rules yet. Create one to start receiving alerts.</div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Device / sensor</th>
                <th>Condition</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Cooldown</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (rule of rules(); track rule.id) {
                <tr>
                  <td>
                    <span class="badge" [class]="rule.enabled ? 'badge-success' : 'badge-muted'">
                      {{ rule.enabled ? 'active' : 'paused' }}
                    </span>
                  </td>
                  <td>
                    <div class="col">
                      <strong>{{ rule.sensorName }}</strong>
                      <span class="muted">{{ rule.deviceName }}</span>
                    </div>
                  </td>
                  <td class="mono">{{ operatorLabel(rule.operator) }} {{ rule.threshold }} {{ rule.sensorUnit }}</td>
                  <td><span class="badge" [class]="'badge-' + rule.severity">{{ rule.severity }}</span></td>
                  <td>{{ rule.message }}</td>
                  <td class="muted">{{ rule.cooldownMinutes }} min</td>
                  <td class="actions">
                    <button class="btn" (click)="startEdit(rule)">Edit</button>
                    <button class="btn btn-danger" (click)="remove(rule)">Delete</button>
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
      .actions {
        display: flex;
        gap: 0.4rem;
        justify-content: flex-end;
      }
      .actions .btn {
        padding: 0.35rem 0.6rem;
      }
      .col {
        display: flex;
        flex-direction: column;
      }
      .col span {
        font-size: 0.78rem;
      }
    `,
  ],
})
export class Rules {
  private readonly ruleService = inject(RuleService);
  private readonly deviceService = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rules = signal<Rule[]>([]);
  readonly devices = signal<Device[]>([]);
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly operators: RuleOperator[] = ['gt', 'gte', 'lt', 'lte'];

  form: RuleForm = { ...emptyForm };

  readonly sensorOptions = computed(() =>
    this.devices().flatMap((device) =>
      device.sensors.map((sensor) => ({
        id: sensor.id,
        label: `${device.name} · ${sensor.name} (${sensor.key})`,
      })),
    ),
  );

  constructor() {
    this.loadRules();
    this.deviceService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((devices) => this.devices.set(devices));
  }

  operatorLabel(op: RuleOperator): string {
    return operatorLabels[op];
  }

  private loadRules(): void {
    this.ruleService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rules) => this.rules.set(rules));
  }

  startAdd(): void {
    this.form = { ...emptyForm };
    this.formError.set(null);
    this.formOpen.set(true);
  }

  startEdit(rule: Rule): void {
    this.form = {
      id: rule.id,
      sensorId: rule.sensorId,
      operator: rule.operator,
      threshold: rule.threshold,
      severity: rule.severity,
      message: rule.message,
      enabled: rule.enabled,
      cooldownMinutes: rule.cooldownMinutes,
    };
    this.formError.set(null);
    this.formOpen.set(true);
  }

  save(): void {
    if (this.form.sensorId === null) {
      this.formError.set('Select a sensor.');
      return;
    }
    if (this.form.threshold === null || Number.isNaN(this.form.threshold)) {
      this.formError.set('Enter a threshold value.');
      return;
    }
    if (!this.form.message) {
      this.formError.set('Enter an alert message.');
      return;
    }

    const payload: RuleInput = {
      sensorId: this.form.sensorId,
      operator: this.form.operator,
      threshold: this.form.threshold,
      severity: this.form.severity,
      message: this.form.message,
      enabled: this.form.enabled,
      cooldownMinutes: this.form.cooldownMinutes ?? 10,
    };

    this.saving.set(true);
    this.formError.set(null);

    const request = this.form.id === null
      ? this.ruleService.create(payload)
      : this.ruleService.update(this.form.id, payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.loadRules();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.formError.set(err.error?.message ?? 'Could not save rule.');
      },
    });
  }

  remove(rule: Rule): void {
    if (!confirm(`Delete rule "${rule.message}"?`)) {
      return;
    }
    this.ruleService
      .remove(rule.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadRules());
  }
}
