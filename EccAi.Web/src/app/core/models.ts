export interface Sensor {
  id: number;
  deviceId: number;
  key: string;
  name: string;
  unit: string;
  maxExpected: number | null;
  createdAt: string;
  latestValue: number | null;
  latestTimestamp: string | null;
}

export interface Device {
  id: number;
  name: string;
  hardwareId: string;
  pairedAt: string;
  lastSeenAt: string | null;
  isOnline: boolean;
  sensors: Sensor[];
}

export interface MeasurementPoint {
  value: number;
  timestamp: string;
}

export interface DeviceError {
  id: number;
  code: string;
  message: string;
  severity: string;
  timestamp: string;
  acknowledged: boolean;
}

export type RuleOperator = 'gt' | 'gte' | 'lt' | 'lte';
export type Severity = 'info' | 'warning' | 'critical' | 'error';

export interface Rule {
  id: number;
  sensorId: number;
  sensorName: string;
  sensorUnit: string;
  deviceId: number;
  deviceName: string;
  operator: RuleOperator;
  threshold: number;
  severity: Severity;
  message: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
}

export interface RuleInput {
  sensorId: number;
  operator: RuleOperator;
  threshold: number;
  severity: Severity;
  message: string;
  enabled: boolean;
  cooldownMinutes: number;
}

export interface Alert {
  id: number;
  ruleId: number;
  sensorId: number;
  sensorName: string;
  deviceId: number;
  deviceName: string;
  value: number;
  message: string;
  severity: Severity;
  createdAt: string;
  acknowledged: boolean;
}

export interface DashboardAlert {
  id: number;
  severity: Severity;
  message: string;
  value: number;
  createdAt: string;
  acknowledged: boolean;
  sensorName: string;
  deviceName: string;
}

export interface DashboardSummary {
  deviceCount: number;
  onlineCount: number;
  sensorCount: number;
  openAlertCount: number;
  unacknowledgedErrorCount: number;
  devices: Device[];
  openAlerts: DashboardAlert[];
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export interface LoginResponse extends AuthUser {
  token: string;
}

export interface PairingCode {
  code: string;
  expiresAt: string;
}
