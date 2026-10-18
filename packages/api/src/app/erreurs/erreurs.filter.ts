import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError, ApiFieldError } from '@personal-os/contracts';
import { ErreurDEspace, type RaisonDuRefus } from '@personal-os/database';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { ZodValidationException } from 'nestjs-zod';
import type { z } from 'zod';
import { ErreurMetier } from './erreur-metier';

const journal = new Logger('ErreursFilter');

const MESSAGE_INDISPONIBLE = 'Le service est momentanément indisponible.';

const MESSAGE_DE_DEFAUT =
  'Une erreur inattendue est survenue. Réessaie dans un instant.';

/**
 * Le seul filtre d'exceptions de l'API : toute erreur sort dans l'enveloppe
 * `{ status, code, message, fields? }` (ADR 0030). Une 500 est un défaut de
 * notre côté : elle est journalisée, et la réponse n'en dit rien.
 */
@Catch()
export class ErreursFilter implements ExceptionFilter {
  catch(erreur: unknown, hote: ArgumentsHost): void {
    const http = hote.switchToHttp();
    // Express ne pose `req.route` qu'une fois une route atteinte : sans elle,
    // l'erreur vient du framework (parseur de body, route inconnue).
    const horsDeRoute = !http.getRequest<Request>().route;
    let enveloppe = envelopper(erreur, horsDeRoute);

    // Quelle qu'en soit la source, une 500 ne dit rien de sa cause.
    if (enveloppe.status === HttpStatus.INTERNAL_SERVER_ERROR) {
      journaliser(erreur);
      enveloppe = { ...enveloppe, message: MESSAGE_DE_DEFAUT };
    }

    http.getResponse<Response>().status(enveloppe.status).json(enveloppe);
  }
}

function envelopper(erreur: unknown, horsDeRoute: boolean): ApiError {
  if (erreur instanceof ErreurMetier) {
    return {
      status: erreur.status,
      code: erreur.code,
      message: erreur.message,
    };
  }
  if (erreur instanceof ZodValidationException) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'request.invalid',
      message: 'La requête ne respecte pas le schéma attendu.',
      fields: champsRefuses(erreur.getZodError()),
    };
  }
  if (erreur instanceof ErreurDEspace) {
    return refusDEspace(erreur.raison, erreur.message);
  }
  if (
    erreur instanceof HttpException &&
    erreur.getStatus() !== HttpStatus.INTERNAL_SERVER_ERROR
  ) {
    const status = erreur.getStatus();
    return {
      status,
      code: `http.${status}`,
      message:
        horsDeRoute || erreur.message === STATUS_CODES[status]
          ? messageDuFramework(status)
          : erreur.message,
    };
  }
  const refusDExpress = statutDeRefusDExpress(erreur);
  if (refusDExpress) {
    return {
      status: refusDExpress,
      code: `http.${refusDExpress}`,
      message: messageDuFramework(refusDExpress),
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'internal',
    message: MESSAGE_DE_DEFAUT,
  };
}

/**
 * Ce qui vient de la requête est un 403 ou un 422 ; ce qui vient d'un module
 * mal déclaré est un 500, un défaut à corriger et non une réponse à servir.
 */
function refusDEspace(raison: RaisonDuRefus, message: string): ApiError {
  switch (raison) {
    case 'hors-portee':
      return {
        status: HttpStatus.FORBIDDEN,
        code: 'scope.out_of_reach',
        message,
      };
    case 'type-refuse':
      return {
        status: HttpStatus.FORBIDDEN,
        code: 'scope.kind_refused',
        message,
      };
    case 'absent':
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'scope.missing',
        message,
      };
    case 'sans-portee':
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'scope.undeclared',
        message: MESSAGE_DE_DEFAUT,
      };
  }
}

/**
 * Les messages que Nest et Express écrivent d'eux-mêmes sont en anglais : le
 * libellé du statut (`new NotFoundException()`), « Cannot GET /x » pour une
 * route inconnue, le diagnostic du parseur JSON. Ceux de l'API, explicites et
 * levés depuis une route, sont en français et passent tels quels.
 */
const MESSAGES_DU_FRAMEWORK: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'La requête est mal formée.',
  [HttpStatus.UNAUTHORIZED]: 'Une session est requise.',
  [HttpStatus.FORBIDDEN]: 'Cette action est refusée.',
  [HttpStatus.NOT_FOUND]: 'Aucune ressource à cette adresse.',
  [HttpStatus.METHOD_NOT_ALLOWED]: "Cette méthode n'est pas acceptée ici.",
  [HttpStatus.REQUEST_TIMEOUT]: 'La requête a pris trop de temps.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'La requête est trop volumineuse.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]:
    "Ce format de contenu n'est pas accepté.",
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Trop de requêtes : réessaie dans un instant.',
  [HttpStatus.SERVICE_UNAVAILABLE]: MESSAGE_INDISPONIBLE,
};

function messageDuFramework(status: number): string {
  return (
    MESSAGES_DU_FRAMEWORK[status] ??
    (status < HttpStatus.INTERNAL_SERVER_ERROR
      ? 'La requête a été refusée.'
      : MESSAGE_INDISPONIBLE)
  );
}

/**
 * Un refus du parseur de body (body trop gros, encodage refusé) n'est pas une
 * HttpException : c'est une erreur `http-errors` qui porte son statut. Un 4xx
 * reste un refus de la requête ; le reste est un défaut. Un JSON illisible,
 * lui, arrive déjà traduit par Nest en `BadRequestException`.
 */
function statutDeRefusDExpress(erreur: unknown): number | null {
  if (!(erreur instanceof Error)) {
    return null;
  }
  const { statusCode } = erreur as Error & { statusCode?: unknown };
  return typeof statusCode === 'number' &&
    statusCode >= HttpStatus.BAD_REQUEST &&
    statusCode < HttpStatus.INTERNAL_SERVER_ERROR
    ? statusCode
    : null;
}

function champsRefuses(erreurZod: unknown): ApiFieldError[] {
  const issues = (erreurZod as Partial<z.ZodError> | undefined)?.issues ?? [];

  return issues.map(({ path, code, message }) => ({
    path: path.map(String).join('.'),
    code,
    message,
  }));
}

function journaliser(erreur: unknown): void {
  if (erreur instanceof Error) {
    journal.error(erreur.message, erreur.stack);
  } else {
    journal.error(String(erreur));
  }
}
