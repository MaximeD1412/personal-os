import type { INestApplication } from '@nestjs/common';
import {
  PrismaService,
  sousPortee,
  type TypeEspace,
} from '@personal-os/database';

/** Une exception telle qu'un test la pose : ses instants en ISO. */
export interface ExceptionDeTest {
  eventId: string;
  originalStart: string;
  kind: 'CANCELLED' | 'MODIFIED';
  startsAt?: string;
  endsAt?: string;
  title?: string;
}

/**
 * Pose des exceptions à la règle d'un Événement, sans passer par les routes
 * qui les écrivent (AGENDA-2) : par l'accès aux données, mais sous une
 * portée, comme tout le monde — il n'existe pas de client nu (ADR 0028).
 */
export function poserDesExceptions(
  app: INestApplication,
  espace: { id: string; kind: TypeEspace },
  exceptions: readonly ExceptionDeTest[],
): Promise<unknown> {
  const prisma = app.get(PrismaService);

  // Une requête Prisma ne part qu'à son `then` : on l'attend dans la portée,
  // sans quoi elle partirait hors d'elle.
  return sousPortee(
    { espaces: [espace], typesAcceptes: [espace.kind] },
    async () =>
      await prisma.eventException.createMany({
        data: exceptions.map((exception) => ({
          scopeId: espace.id,
          eventId: exception.eventId,
          originalStart: new Date(exception.originalStart),
          kind: exception.kind,
          startsAt: exception.startsAt ? new Date(exception.startsAt) : null,
          endsAt: exception.endsAt ? new Date(exception.endsAt) : null,
          title: exception.title ?? null,
        })),
      }),
  );
}

/** Le nombre d'exceptions d'un Événement, lues sous la même portée. */
export function compterLesExceptions(
  app: INestApplication,
  espace: { id: string; kind: TypeEspace },
  eventId: string,
): Promise<number> {
  const prisma = app.get(PrismaService);

  return sousPortee(
    { espaces: [espace], typesAcceptes: [espace.kind] },
    async () => await prisma.eventException.count({ where: { eventId } }),
  );
}
