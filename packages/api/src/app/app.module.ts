import { Module } from '@nestjs/common';
import { DatabaseModule } from '@personal-os/database';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, AuthModule, HealthModule],
})
export class AppModule {}
