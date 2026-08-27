import { NotFoundException } from '@nestjs/common';
import { TraceService } from './trace.service';
import type { TraceRepository } from './trace.repository';

describe('TraceService', () => {
  it('ne transforme pas une panne de base en 404', async () => {
    const panne = new Error('base indisponible');
    const repository = {
      renommer: () => Promise.reject(panne),
    } as unknown as TraceRepository;
    const service = new TraceService(repository);

    await expect(service.renommer('trace-1', { label: 'x' })).rejects.toBe(
      panne,
    );
  });

  it('transforme uniquement une absence Prisma en 404', async () => {
    const absence = Object.assign(new Error('not found'), { code: 'P2025' });
    const repository = {
      renommer: () => Promise.reject(absence),
    } as unknown as TraceRepository;
    const service = new TraceService(repository);

    await expect(
      service.renommer('trace-1', { label: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
