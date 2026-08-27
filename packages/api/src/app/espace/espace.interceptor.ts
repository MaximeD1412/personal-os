import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { poserPortee, type TypeEspace } from '@personal-os/database';
import type { Request } from 'express';
import type { UserRecord } from '../auth/auth.repository';
import { PORTEUR } from '../auth/current-user.decorator';
import { EspaceRepository } from './espace.repository';
import { ESPACES_ACCEPTES } from './espaces.decorator';

/**
 * Pose la portée d'Espace de la requête : les Espaces du Compte connecté,
 * croisés avec ceux que le module accepte.
 *
 * C'est un intercepteur et non une garde, parce que Nest les exécute **après**
 * toutes les gardes : la session est donc lue quand celui-ci s'exécute, sans
 * dépendre de l'ordre d'enregistrement des gardes globales.
 *
 * Quand il ne pose rien — route publique, ou module qui n'a rien déclaré —
 * aucune requête cloisonnée ne peut aboutir. C'est voulu : le silence serait
 * pire que l'échec.
 */
@Injectable()
export class EspaceInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly espaces: EspaceRepository,
  ) {}

  async intercept(
    context: ExecutionContext,
    suite: CallHandler,
  ): Promise<ReturnType<CallHandler['handle']>> {
    const typesAcceptes = this.reflector.getAllAndOverride<TypeEspace[]>(
      ESPACES_ACCEPTES,
      [context.getHandler(), context.getClass()],
    );

    const requete = context.switchToHttp().getRequest<Request>();
    const porteur = (requete as Request & Record<string, UserRecord | undefined>)[
      PORTEUR
    ];

    if (typesAcceptes && porteur) {
      poserPortee({
        espaces: await this.espaces.espacesDe(porteur.id),
        typesAcceptes,
      });
    }

    return suite.handle();
  }
}
