import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ErreurMetier, Introuvable } from '../erreurs/erreur-metier';

/**
 * La garde des routes internes : seul l'agent de sauvegarde les appelle, de
 * la machine elle-même, avec le jeton partagé `BACKUP_STATUS_TOKEN`.
 *
 * Le proxy du tableau de bord ne les route pas (`packages/dashboard/nginx.conf`).
 * Si une requête arrive tout de même relayée (elle porte `X-Forwarded-For`),
 * elle reçoit le 404 d'une route qui n'existe pas, jeton ou non : la route
 * reste invisible depuis Internet.
 *
 * Sans jeton configuré, tout est refusé : l'API démarre, mais personne ne peut
 * écrire l'état des sauvegardes.
 */
@Injectable()
export class BackupTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requete = context.switchToHttp().getRequest<Request>();
    if (requete.headers['x-forwarded-for'] !== undefined) {
      throw new Introuvable('backup.not_found', 'Route introuvable.');
    }

    const attendu = process.env['BACKUP_STATUS_TOKEN'] ?? '';
    if (attendu === '') {
      throw jetonRequis(
        "Aucun jeton n'est configuré : l'état des sauvegardes ne peut pas être transmis.",
      );
    }

    const presente = jetonPorte(requete.headers.authorization);
    if (presente === null) {
      throw jetonRequis('Aucun jeton.');
    }
    if (!memeJeton(presente, attendu)) {
      throw jetonRequis('Jeton invalide.');
    }
    return true;
  }
}

function jetonPorte(entete: string | undefined): string | null {
  const [schema, jeton] = (entete ?? '').split(' ');
  return schema?.toLowerCase() === 'bearer' && jeton ? jeton : null;
}

/** Une comparaison en temps constant, quelle que soit la longueur des jetons. */
function memeJeton(presente: string, attendu: string): boolean {
  const empreinte = (valeur: string) =>
    createHash('sha256').update(valeur).digest();
  return timingSafeEqual(empreinte(presente), empreinte(attendu));
}

function jetonRequis(message: string): ErreurMetier {
  return new ErreurMetier(
    'backup.token_required',
    message,
    HttpStatus.UNAUTHORIZED,
  );
}
