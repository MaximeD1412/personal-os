import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@personal-os/contracts';
import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async read(): Promise<HealthResponse> {
    const probe = await this.repository.findLatestProbe();

    if (!probe) {
      throw new ServiceUnavailableException(
        "La base est joignable mais ne porte aucune sonde : elle n'a pas été amorcée.",
      );
    }

    return {
      status: 'ok',
      database: {
        label: probe.label,
        recordedAt: probe.recordedAt.toISOString(),
      },
    };
  }
}
