import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ErreurMetier } from '../erreurs/erreur-metier';
import type { UserRecord } from './auth.repository';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, readCookie } from './cookies';
import { PORTEUR } from './current-user.decorator';
import { IS_PUBLIC } from './public.decorator';

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
      throw sessionRequise('Aucune session.');
    }

    const porteur = await this.auth.porteurDeSession(token);
    if (!porteur) {
      throw sessionRequise('Session inconnue, expirée ou révoquée.');
    }

    (request as Request & Record<string, UserRecord>)[PORTEUR] = porteur;
    return true;
  }
}

function sessionRequise(message: string): ErreurMetier {
  return new ErreurMetier('auth.required', message, HttpStatus.UNAUTHORIZED);
}
