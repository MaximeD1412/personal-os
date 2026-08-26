import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRecord } from './auth.repository';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, readCookie } from './cookies';
import { PORTEUR } from './current-user.decorator';
import { IS_PUBLIC } from './public.decorator';

/**
 * Garde globale : aucune requête n'atteint un contrôleur sans session valide,
 * sauf si la route porte `@Public()`.
 *
 * Elle est posée en `APP_GUARD` et non module par module. C'est le corollaire
 * des modules plats (ADR 0016) : plus les modules sont simples, plus la
 * garantie doit tenir à un mécanisme unique — un module qui oublierait de se
 * protéger n'existe pas, puisqu'il n'a rien à faire pour l'être.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) {
      throw new UnauthorizedException('Aucune session.');
    }

    // La session est relue en base à chaque requête, et c'est le prix à payer
    // pour que la révocation soit immédiate : un jeton signé auto-porteur
    // resterait valable jusqu'à son expiration, quoi qu'on décide entre-temps.
    const porteur = await this.auth.porteurDeSession(token);
    if (!porteur) {
      throw new UnauthorizedException('Session inconnue, expirée ou révoquée.');
    }

    (request as Request & Record<string, UserRecord>)[PORTEUR] = porteur;
    return true;
  }
}
