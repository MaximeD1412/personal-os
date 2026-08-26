/**
 * Instantané de la sonde technique lue en base.
 *
 * `recordedAt` est une date ISO-8601 : les contrats transitent en JSON, ils ne
 * portent jamais de `Date`.
 */
export interface HealthProbeSnapshot {
  label: string;
  recordedAt: string;
}

/** Réponse de `GET /api/health`. */
export interface HealthResponse {
  status: 'ok';
  database: HealthProbeSnapshot;
}
