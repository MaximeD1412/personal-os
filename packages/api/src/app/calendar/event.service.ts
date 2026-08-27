import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EVENT_CATEGORIES,
  type Event,
  type EventCategory,
  type EventInput,
  type EventUpdate,
} from '@personal-os/contracts';
import { ErreurDEspace } from '@personal-os/database';
import {
  EventRepository,
  type EventRecord,
  type EventWrite,
} from './event.repository';

@Injectable()
export class EventService {
  constructor(private readonly repository: EventRepository) {}

  async lister(): Promise<Event[]> {
    return (await this.repository.lister()).map(exposer);
  }

  async creer(saisie: Partial<EventInput>): Promise<Event> {
    return exposer(await this.repository.creer(valider(saisie)));
  }

  async modifier(id: string, saisie: EventUpdate): Promise<Event> {
    const changements = validerPartiellement(saisie);

    if (Object.keys(changements).length === 0) {
      throw new BadRequestException('La modification ne change rien.');
    }

    await this.verifierLaPeriodeApresCoup(id, changements);

    return exposer(
      await this.introuvableSinon(this.repository.modifier(id, changements)),
    );
  }

  async supprimer(id: string): Promise<void> {
    await this.introuvableSinon(this.repository.supprimer(id));
  }

  /**
   * Une modification qui ne touche qu'une borne de la période ne suffit pas à
   * la juger : l'autre est en base. On relit l'Événement — à travers la garde,
   * donc borné aux Espaces atteignables — plutôt que de laisser passer une fin
   * antérieure au début, que l'Agenda afficherait ensuite à l'envers.
   */
  private async verifierLaPeriodeApresCoup(
    id: string,
    changements: Partial<EventWrite>,
  ): Promise<void> {
    const toucheUneBorne =
      'startsAt' in changements || 'endsAt' in changements;

    if (!toucheUneBorne) {
      return;
    }

    const actuel = await this.repository.lire(id);
    if (!actuel) {
      // La rangée est hors de portée ou n'existe pas : c'est la modification
      // elle-même qui répondra « introuvable », comme partout ailleurs.
      return;
    }

    verifierLaPeriode(
      changements.startsAt ?? actuel.startsAt,
      changements.endsAt !== undefined ? changements.endsAt : actuel.endsAt,
    );
  }

  /**
   * Un Événement d'un autre Espace est hors du filtre de la garde : Prisma ne
   * le trouve pas. On répond « introuvable » plutôt qu'« interdit », pour ne
   * pas confirmer son existence à qui aurait deviné son identifiant.
   */
  private async introuvableSinon(
    operation: Promise<EventRecord>,
  ): Promise<EventRecord> {
    try {
      return await operation;
    } catch (erreur) {
      // Un refus de la garde est un défaut ou une intrusion : il doit remonter
      // tel quel. Seule l'absence de rangée devient un « introuvable » ; une
      // panne de base ne doit jamais être déguisée en erreur métier.
      if (erreur instanceof ErreurDEspace) {
        throw erreur;
      }
      if (estAbsencePrisma(erreur)) {
        throw new NotFoundException('Aucun Événement de cet identifiant.');
      }
      throw erreur;
    }
  }
}

/**
 * Une création nomme tout ce qui est obligatoire, l'Espace compris : le
 * Calendrier acceptant les deux, rien ne permettrait de le deviner (ADR 0014).
 */
function valider(saisie: Partial<EventInput>): EventWrite {
  const startsAt = instantRequis(saisie.startsAt, 'startsAt');
  const endsAt = instantFacultatif(saisie.endsAt, 'endsAt');

  verifierLaPeriode(startsAt, endsAt);

  return {
    title: texteRequis(saisie.title, 'title'),
    startsAt,
    endsAt,
    category: categorieRequise(saisie.category),
    reminderLeadMinutes: delaiDeRappel(saisie.reminderLeadMinutes),
    scopeId: texteRequis(saisie.scopeId, 'scopeId'),
  };
}

/**
 * Une modification ne porte que ce qu'elle change. L'Espace n'a pas à être
 * répété — le filtre a déjà borné l'Événement aux Espaces atteignables —, mais
 * le nommer déplace l'Événement, et la garde le vérifie (ADR 0028).
 */
function validerPartiellement(saisie: EventUpdate): Partial<EventWrite> {
  const changements: Partial<EventWrite> = {};

  if ('title' in saisie) {
    changements.title = texteRequis(saisie.title, 'title');
  }
  if ('startsAt' in saisie) {
    changements.startsAt = instantRequis(saisie.startsAt, 'startsAt');
  }
  if ('endsAt' in saisie) {
    changements.endsAt = instantFacultatif(saisie.endsAt, 'endsAt');
  }
  if ('category' in saisie) {
    changements.category = categorieRequise(saisie.category);
  }
  if ('reminderLeadMinutes' in saisie) {
    changements.reminderLeadMinutes = delaiDeRappel(
      saisie.reminderLeadMinutes,
    );
  }
  if ('scopeId' in saisie) {
    changements.scopeId = texteRequis(saisie.scopeId, 'scopeId');
  }

  return changements;
}

function verifierLaPeriode(startsAt: Date, endsAt: Date | null): void {
  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw new BadRequestException(
      "La fin d'un Événement ne précède pas son début.",
    );
  }
}

function estAbsencePrisma(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'code' in erreur &&
    erreur.code === 'P2025'
  );
}

function exposer(evenement: EventRecord): Event {
  return {
    id: evenement.id,
    title: evenement.title,
    startsAt: evenement.startsAt.toISOString(),
    endsAt: evenement.endsAt?.toISOString() ?? null,
    category: evenement.category,
    reminderLeadMinutes: evenement.reminderLeadMinutes,
    scopeId: evenement.scopeId,
    createdAt: evenement.createdAt.toISOString(),
  };
}

function texteRequis(valeur: unknown, champ: string): string {
  if (typeof valeur !== 'string' || valeur.trim().length === 0) {
    throw new BadRequestException(`${champ} est requis.`);
  }
  return valeur.trim();
}

function instantRequis(valeur: unknown, champ: string): Date {
  const instant = instantFacultatif(valeur, champ);
  if (!instant) {
    throw new BadRequestException(`${champ} est requis.`);
  }
  return instant;
}

function instantFacultatif(valeur: unknown, champ: string): Date | null {
  if (valeur === undefined || valeur === null || valeur === '') {
    return null;
  }
  if (typeof valeur !== 'string') {
    throw new BadRequestException(`${champ} attend une date ISO-8601.`);
  }

  const instant = new Date(valeur);
  if (Number.isNaN(instant.getTime())) {
    throw new BadRequestException(`${champ} attend une date ISO-8601.`);
  }
  return instant;
}

function categorieRequise(valeur: unknown): EventCategory {
  if (!EVENT_CATEGORIES.includes(valeur as EventCategory)) {
    throw new BadRequestException(
      `category attend l'une de : ${EVENT_CATEGORIES.join(', ')}.`,
    );
  }
  return valeur as EventCategory;
}

/** Un rappel est un délai en minutes avant le début, ou rien du tout. */
function delaiDeRappel(valeur: unknown): number | null {
  if (valeur === undefined || valeur === null || valeur === '') {
    return null;
  }
  if (
    typeof valeur !== 'number' ||
    !Number.isInteger(valeur) ||
    valeur < 0
  ) {
    throw new BadRequestException(
      'reminderLeadMinutes attend un nombre entier de minutes, positif ou nul.',
    );
  }
  return valeur;
}
