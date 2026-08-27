import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ouvrirPorteeVide } from '@personal-os/database';
import type { NextFunction, Request, Response } from 'express';

/**
 * Ouvre le porte-portée au tout début de la requête, avant qu'on sache qui la
 * présente. L'intercepteur y posera la portée une fois la session lue et le
 * module identifié — il ne pourrait pas l'ouvrir lui-même, car ce qu'il ouvre
 * se refermerait avant que le contrôleur ne s'exécute.
 */
@Injectable()
export class PorteeMiddleware implements NestMiddleware {
  use(_requete: Request, _reponse: Response, suite: NextFunction): void {
    ouvrirPorteeVide(suite);
  }
}
