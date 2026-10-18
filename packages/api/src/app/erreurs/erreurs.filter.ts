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
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { z } from 'zod';
import { ErreurMetier } from './erreur-metier';

const journal = new Logger('ErreursFilter');

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
    const enveloppe = envelopper(erreur);

    if (enveloppe.status === HttpStatus.INTERNAL_SERVER_ERROR) {
      journaliser(erreur);
    }

    hote
      .switchToHttp()
      .getResponse<Response>()
      .status(enveloppe.status)
      .json(enveloppe);
  }
}

function envelopper(erreur: unknown): ApiError {
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
    return {
      status: erreur.getStatus(),
      code: `http.${erreur.getStatus()}`,
      message: erreur.message,
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
