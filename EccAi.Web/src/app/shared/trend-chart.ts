import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MeasurementPoint } from '../core/models';

@Component({
  selector: 'app-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    @if (points().length > 1) {
      <svg class="trend" [attr.viewBox]="'0 0 ' + viewWidth + ' ' + height()" preserveAspectRatio="none">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon [attr.points]="areaPoints()" [attr.fill]="'url(#' + gradientId + ')'" />
        <polyline [attr.points]="linePoints()" fill="none" stroke="var(--accent)" stroke-width="2"
          vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
      </svg>
      <div class="trend-labels">
        <span>{{ min() | number: '1.2-2' }} {{ unit() }}</span>
        <span>max {{ max() | number: '1.2-2' }} {{ unit() }}</span>
      </div>
    } @else {
      <div class="trend-empty">Not enough data to draw a trend yet.</div>
    }
  `,
  styles: [
    `
      .trend {
        width: 100%;
        display: block;
        height: 100%;
      }
      .trend-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.72rem;
        color: var(--text-muted);
        margin-top: 0.25rem;
      }
      .trend-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
        font-size: 0.85rem;
      }
    `,
  ],
})
export class TrendChart {
  readonly points = input.required<MeasurementPoint[]>();
  readonly height = input(200);
  readonly unit = input('A');
  readonly viewWidth = 1000;
  readonly gradientId = 'trend-grad-' + Math.random().toString(36).slice(2, 8);

  private readonly values = computed(() => this.points().map((p) => p.value));

  readonly min = computed(() => (this.values().length ? Math.min(...this.values()) : 0));
  readonly max = computed(() => (this.values().length ? Math.max(...this.values()) : 0));

  private scaled(): { x: number; y: number }[] {
    const pts = this.points();
    const min = this.min();
    const max = this.max();
    const range = max - min || 1;
    const h = this.height();
    const pad = 6;
    return pts.map((p, i) => ({
      x: (i / (pts.length - 1)) * this.viewWidth,
      y: h - pad - ((p.value - min) / range) * (h - pad * 2),
    }));
  }

  readonly linePoints = computed(() =>
    this.scaled()
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' '),
  );

  readonly areaPoints = computed(() => {
    const pts = this.scaled();
    if (pts.length === 0) {
      return '';
    }
    const h = this.height();
    return `0,${h} ` + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` ${this.viewWidth},${h}`;
  });
}
