import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRecord } from './auth.repository';

/** Où la garde dépose le porteur de la session, pour la suite de la requête. */
export const PORTEUR = 'personalOsUser';

/**
 * Le compte qui porte la session courante.
 *
 * Il est toujours présent : une route qui n'est pas `@Public()` n'est atteinte
 * qu'après la garde, et la garde n'a laissé passer que des sessions valides.
 */
export const CurrentUser = createParamDecorator(
  (_donnee: unknown, context: ExecutionContext): UserRecord => {
    const request = context.switchToHttp().getRequest<Request>();
    return (request as Request & Record<string, UserRecord>)[PORTEUR];
  },
);
