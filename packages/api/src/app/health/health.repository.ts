import { Injectable } from '@nestjs/common';
import { PrismaService } from '@personal-os/database';

export interface HealthProbeRecord {
  id: string;
  label: string;
  recordedAt: Date;
}

@Injectable()
export class HealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatestProbe(): Promise<HealthProbeRecord | null> {
    return this.prisma.healthProbe.findFirst({
      orderBy: { recordedAt: 'desc' },
    });
  }
}
