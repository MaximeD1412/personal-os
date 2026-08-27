import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTH_CONFIG, lireAuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { OidcClient } from './oidc.client';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: lireAuthConfig },
    AuthService,
    AuthRepository,
    OidcClient,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
