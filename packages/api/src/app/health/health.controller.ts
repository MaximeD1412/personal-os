import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@personal-os/contracts';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  read(): Promise<HealthResponse> {
    return this.health.read();
  }
}
