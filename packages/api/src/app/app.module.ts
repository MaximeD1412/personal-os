import { Module } from '@nestjs/common';
import { DatabaseModule } from '@personal-os/database';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { EspaceModule } from './espace/espace.module';
import { HealthModule } from './health/health.module';
import { TraceModule } from './traces/trace.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    EspaceModule,
    HealthModule,
    TraceModule,
    CalendarModule,
  ],
})
export class AppModule {}
