import { Injectable } from '@nestjs/common';
import { PrismaService } from '@personal-os/database';

/** La sonde technique telle qu'elle est stockée. */
export interface HealthProbeRecord {
  id: string;
  label: string;
  recordedAt: Date;
}

/** Accès aux données du module Health (ADR 0016 : module plat). */
@Injectable()
export class HealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatestProbe(): Promise<HealthProbeRecord | null> {
    return this.prisma.healthProbe.findFirst({
      orderBy: { recordedAt: 'desc' },
    });
  }
}
