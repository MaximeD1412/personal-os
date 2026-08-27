export interface HealthProbeSnapshot {
  label: string;
  recordedAt: string;
}

export interface HealthResponse {
  status: 'ok';
  database: HealthProbeSnapshot;
}
