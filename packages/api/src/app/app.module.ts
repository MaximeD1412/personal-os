import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { DatabaseModule } from '@personal-os/database';
import { ZodValidationPipe } from 'nestjs-zod';
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
  providers: [
    // Tout body, query ou param typé par un DTO zod de `contracts` est validé
    // avant d'atteindre le contrôleur (ADR 0030).
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
