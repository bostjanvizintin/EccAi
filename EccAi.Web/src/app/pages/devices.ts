import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DeviceService } from '../core/device.service';
import { Device } from '../core/models';

@Component({
  selector: 'app-devices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Devices</h1>
          <p>Microcontrollers paired to your account.</p>
        </div>
        <button class="btn btn-primary" (click)="openPairing()">Pair device</button>
      </div>

      @if (devices(); as list) {
        @if (list.length === 0) {
          <div class="card empty-state">
            No devices yet. Click <strong>Pair device</strong> to generate a pairing code.
          </div>
        } @else {
          <div class="card table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Name</th>
                  <th>Hardware ID</th>
                  <th>Sensors</th>
                  <th>Last seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (device of list; track device.id) {
                  <tr>
                    <td>
                      <span class="badge" [class]="device.isOnline ? 'badge-success' : 'badge-muted'">
                        {{ device.isOnline ? 'online' : 'offline' }}
                      </span>
                    </td>
                    <td><a [routerLink]="['/devices', device.id]">{{ device.name }}</a></td>
                    <td class="mono">{{ device.hardwareId }}</td>
                    <td>{{ device.sensors.length }}</td>
                    <td class="muted">{{ device.lastSeenAt ? (device.lastSeenAt | date: 'short') : 'never' }}</td>
                    <td class="actions">
                      <a class="btn btn-ghost" [routerLink]="['/devices', device.id]">Open</a>
                      <button class="btn btn-danger" (click)="remove(device)">Unpair</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <div class="card empty-state">Loading…</div>
      }
    </div>

    @if (pairingOpen()) {
      <div class="modal-backdrop" (click)="closePairing()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Pair a microcontroller</h2>
          <p class="muted">
            Enter this code on the device, or run the simulator with
            <span class="mono">--code</span>. Codes expire after 30 minutes.
          </p>

          @if (pairingCode(); as code) {
            <div class="pairing-code">{{ code }}</div>
            <p class="muted">Waiting for a device to pair…</p>
          } @else {
            <div class="empty-state">Generating code…</div>
          }

          <div class="row">
            <span class="spacer"></span>
            <button class="btn" (click)="closePairing()">Close</button>
          </div>
        </div>
      </div>
    }
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
      .btn-ghost {
        padding: 0.35rem 0.6rem;
      }
      .btn-danger {
        padding: 0.35rem 0.6rem;
      }
    `,
  ],
})
export class Devices {
  private readonly deviceService = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly devices = signal<Device[] | null>(null);
  readonly pairingOpen = signal(false);
  readonly pairingCode = signal<string | null>(null);

  private poll?: ReturnType<typeof setInterval>;

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.deviceService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.devices.set(list),
        error: () => this.devices.set([]),
      });
  }

  openPairing(): void {
    this.pairingOpen.set(true);
    this.pairingCode.set(null);
    this.deviceService
      .createPairingCode()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (code) => this.pairingCode.set(code.code) });

    clearInterval(this.poll);
    this.poll = setInterval(() => {
      this.deviceService
        .list()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((list) => {
          const currentCount = this.devices()?.length ?? 0;
          if (list.length > currentCount) {
            this.closePairing();
            this.devices.set(list);
          }
        });
    }, 3000);
  }

  closePairing(): void {
    this.pairingOpen.set(false);
    clearInterval(this.poll);
    this.poll = undefined;
    this.refresh();
  }

  remove(device: Device): void {
    if (!confirm(`Unpair "${device.name}" and delete its data?`)) {
      return;
    }
    this.deviceService
      .remove(device.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }
}
