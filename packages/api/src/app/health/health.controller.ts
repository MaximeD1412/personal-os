import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@personal-os/contracts';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Publique, et elle doit le rester : l'agent de déploiement l'interroge pour
   * décider s'il garde la nouvelle version ou revient à la précédente. La
   * fermer arrêterait tous les déploiements. Elle ne dit rien de personnel —
   * un libellé de sonde et une date.
   */
  @Public()
  @Get()
  read(): Promise<HealthResponse> {
    return this.health.read();
  }
}
