import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ErreurDEspaceFilter } from './erreur-d-espace.filter';
import { EspaceController } from './espace.controller';
import { EspaceInterceptor } from './espace.interceptor';
import { EspaceRepository } from './espace.repository';
import { PorteeMiddleware } from './portee.middleware';

@Module({
  controllers: [EspaceController],
  providers: [
    EspaceRepository,
    { provide: APP_INTERCEPTOR, useClass: EspaceInterceptor },
    { provide: APP_FILTER, useClass: ErreurDEspaceFilter },
  ],
  exports: [EspaceRepository],
})
export class EspaceModule implements NestModule {
  configure(consommateur: MiddlewareConsumer): void {
    consommateur.apply(PorteeMiddleware).forRoutes('*splat');
  }
}
