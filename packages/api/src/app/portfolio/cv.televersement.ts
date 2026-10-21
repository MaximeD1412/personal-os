import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
  type PipeTransform,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TAILLE_MAX_DU_CV } from '@personal-os/contracts';
import { ZodValidationException } from 'nestjs-zod';
import * as z from 'zod';
import { ErreurMetier } from '../erreurs/erreur-metier';

/** Le champ multipart qui porte le fichier. */
export const CHAMP_DU_FICHIER = 'file';

export const CV_INVALIDE = 'portfolio.cv_invalid';

const Multer = FileInterceptor(CHAMP_DU_FICHIER, {
  // En mémoire : 5 Mo au plus, aussitôt déposés dans le stockage objet.
  // Busboy refuse le fichier dès qu'il atteint la limite : un octet de marge
  // laisse passer celui de 5 Mo tout juste.
  limits: { fileSize: TAILLE_MAX_DU_CV + 1, files: 1 },
});

/**
 * Lit le fichier téléversé. Un fichier trop lourd est coupé à 5 Mo par multer,
 * qui le refuse en 413 : c'est ici une règle du CV, rendue en 422 comme le
 * fichier qui n'est pas un PDF.
 */
@Injectable()
export class TeleversementDuCv implements NestInterceptor {
  private readonly multer = new Multer();

  async intercept(context: ExecutionContext, suite: CallHandler) {
    try {
      return await this.multer.intercept(context, suite);
    } catch (erreur) {
      if (erreur instanceof PayloadTooLargeException) {
        throw new ErreurMetier(CV_INVALIDE, 'Le CV ne doit pas dépasser 5 Mo.');
      }
      throw erreur;
    }
  }
}

/** Une requête sans fichier ne respecte pas la forme attendue : un 400 sur `file`. */
@Injectable()
export class FichierRequis implements PipeTransform {
  transform(fichier: Express.Multer.File | undefined): Express.Multer.File {
    if (!fichier) {
      throw new ZodValidationException(
        new z.ZodError([
          {
            code: 'custom',
            path: [CHAMP_DU_FICHIER],
            message: 'Un fichier PDF est attendu.',
            input: undefined,
          },
        ]),
      );
    }
    return fichier;
  }
}
