import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardSummary,
  Device,
  DeviceError,
  MeasurementPoint,
  PairingCode,
} from './models';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/dashboard');
  }

  list(): Observable<Device[]> {
    return this.http.get<Device[]>('/api/devices');
  }

  get(id: number): Observable<Device> {
    return this.http.get<Device>(`/api/devices/${id}`);
  }

  createPairingCode(): Observable<PairingCode> {
    return this.http.post<PairingCode>('/api/pairing-codes', {});
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/devices/${id}`);
  }

  createSensor(
    deviceId: number,
    sensor: { key: string; name: string; unit: string; maxExpected: number | null },
  ): Observable<unknown> {
    return this.http.post(`/api/devices/${deviceId}/sensors`, sensor);
  }

  updateSensor(
    sensorId: number,
    sensor: { name: string; unit: string; maxExpected: number | null },
  ): Observable<unknown> {
    return this.http.put(`/api/sensors/${sensorId}`, sensor);
  }

  deleteSensor(sensorId: number): Observable<void> {
    return this.http.delete<void>(`/api/sensors/${sensorId}`);
  }

  getMeasurements(sensorId: number, limit = 200): Observable<MeasurementPoint[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<MeasurementPoint[]>(`/api/sensors/${sensorId}/measurements`, { params });
  }

  getErrors(deviceId: number): Observable<DeviceError[]> {
    return this.http.get<DeviceError[]>(`/api/devices/${deviceId}/errors`);
  }

  acknowledgeError(errorId: number): Observable<void> {
    return this.http.post<void>(`/api/errors/${errorId}/acknowledge`, {});
  }
}
