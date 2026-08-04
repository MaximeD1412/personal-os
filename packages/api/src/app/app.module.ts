import { Module } from '@nestjs/common';
import { DatabaseModule } from '@personal-os/database';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, HealthModule],
})
export class AppModule {}
