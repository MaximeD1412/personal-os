import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthProbeRecord, HealthRepository } from './health.repository';

function repositoryReturning(
  probe: HealthProbeRecord | null,
): HealthRepository {
  return {
    findLatestProbe: async () => probe,
  } as HealthRepository;
}

describe('HealthService', () => {
  it('expose le libellé de la sonde enregistrée en base', async () => {
    const service = new HealthService(
      repositoryReturning({
        id: '9f1d3c7a-0000-4000-8000-000000000000',
        label: 'Personal OS',
        recordedAt: new Date('2026-08-04T08:30:00.000Z'),
      }),
    );

    await expect(service.read()).resolves.toEqual({
      status: 'ok',
      database: {
        label: 'Personal OS',
        recordedAt: '2026-08-04T08:30:00.000Z',
      },
    });
  });

  it('signale un service indisponible quand la base ne porte aucune sonde', async () => {
    const service = new HealthService(repositoryReturning(null));

    await expect(service.read()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
