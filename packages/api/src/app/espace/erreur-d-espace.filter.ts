import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ErreurDEspace, type RaisonDuRefus } from '@personal-os/database';
import type { Response } from 'express';

/**
 * Traduit un refus de la garde d'Espace en réponse HTTP. La distinction compte :
 * ce qui vient de la requête est un 403 ou un 422, ce qui vient d'un module mal
 * déclaré est un 500 — un défaut à corriger, pas une réponse à servir.
 */
@Catch(ErreurDEspace)
export class ErreurDEspaceFilter implements ExceptionFilter {
  private static readonly logger = new Logger(ErreurDEspaceFilter.name);

  catch(erreur: ErreurDEspace, hote: ArgumentsHost): void {
    const reponse = hote.switchToHttp().getResponse<Response>();
    const traduite = traduire(erreur.raison, erreur.message);

    if (traduite.getStatus() >= 500) {
      ErreurDEspaceFilter.logger.error(erreur.message);
    }

    reponse.status(traduite.getStatus()).json(traduite.getResponse());
  }
}

function traduire(raison: RaisonDuRefus, message: string): HttpException {
  switch (raison) {
    case 'hors-portee':
    case 'type-refuse':
      return new ForbiddenException(message);
    case 'absent':
      return new UnprocessableEntityException(message);
    case 'sans-portee':
      return new InternalServerErrorException(
        "Ce module lit des données cloisonnées sans déclarer d'Espace.",
      );
  }
}
