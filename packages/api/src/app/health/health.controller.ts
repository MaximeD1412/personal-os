import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@personal-os/contracts';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  read(): Promise<HealthResponse> {
    return this.health.read();
  }
}
