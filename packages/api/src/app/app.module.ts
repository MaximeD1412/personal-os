import { Module } from '@nestjs/common';
import { DatabaseModule } from '@personal-os/database';
import { AgendaModule } from './agenda/agenda.module';
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
    AgendaModule,
  ],
})
export class AppModule {}
