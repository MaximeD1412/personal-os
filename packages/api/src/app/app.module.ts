import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { DatabaseModule } from '@personal-os/database';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AgendaModule } from './agenda/agenda.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { CommandBarModule } from './command-bar/command-bar.module';
import { ErreursFilter } from './erreurs/erreurs.filter';
import { EspaceModule } from './espace/espace.module';
import { FoodModule } from './food/food.module';
import { HealthModule } from './health/health.module';
import { HouseholdModule } from './household/household.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    EspaceModule,
    HealthModule,
    CalendarModule,
    AgendaModule,
    HouseholdModule,
    AiModule,
    CommandBarModule,
    FoodModule,
    ProjectsModule,
  ],
  providers: [
    // Tout body, query ou param typé par un DTO zod de `contracts` est validé
    // avant d'atteindre le contrôleur (ADR 0030).
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Toute réponse d'une route qui déclare son schéma de sortie le traverse :
    // un champ interne ne peut pas fuiter (ADR 0030).
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    // Toute erreur sort dans la même enveloppe (ADR 0030).
    { provide: APP_FILTER, useClass: ErreursFilter },
  ],
})
export class AppModule {}
