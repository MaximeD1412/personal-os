import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EspaceController } from './espace.controller';
import { EspaceInterceptor } from './espace.interceptor';
import { EspaceRepository } from './espace.repository';
import { PorteeMiddleware } from './portee.middleware';

@Module({
  controllers: [EspaceController],
  providers: [
    EspaceRepository,
    { provide: APP_INTERCEPTOR, useClass: EspaceInterceptor },
  ],
  exports: [EspaceRepository],
})
export class EspaceModule implements NestModule {
  configure(consommateur: MiddlewareConsumer): void {
    consommateur.apply(PorteeMiddleware).forRoutes('*splat');
  }
}
