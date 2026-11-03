import { ID_ESPACE_FOYER, ID_FOYER } from '../lib/espace/foyer';
import { sousPortee, type PorteeEspace } from '../lib/espace/portee';
import { PrismaService } from '../lib/prisma.service';
import type { Semeur } from './seeder';
import { semer } from './seed';

const ADRESSE_A = 'a@demo.test';
const ADRESSE_B = 'b@demo.test';
const COMPTES = [ADRESSE_A, ADRESSE_B] as const;

/** Un mardi d'heure d'hiver : le semis se cale sur ce jour, pas sur l'horloge. */
const MAINTENANT = new Date('2026-11-03T10:00:00.000Z');
const JOUR = 24 * 60 * 60 * 1000;

describe('Le jeu de démo', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('porte des données dans les trois Espaces, dont une Échéance', async () => {
    await semer(prisma, COMPTES, { maintenant: MAINTENANT });

    const a = await espacePersonnelDe(ADRESSE_A);
    const b = await espacePersonnelDe(ADRESSE_B);
    const evenements = await lireSousPortee(() => prisma.event.findMany());

    for (const espace of [a, b, ID_ESPACE_FOYER]) {
      expect(
        evenements.filter(({ scopeId }) => scopeId === espace),
      ).not.toEqual([]);
    }
    expect(evenements.length).toBeGreaterThanOrEqual(10);
    expect(evenements.map(({ category }) => category)).toContain('DEADLINE');
  });

  it("cale ses Événements sur les quatre semaines autour d'aujourd'hui", async () => {
    await semer(prisma, COMPTES, { maintenant: MAINTENANT });

    const evenements = await lireSousPortee(() => prisma.event.findMany());

    for (const { startsAt, endsAt } of evenements) {
      for (const date of [startsAt, endsAt ?? startsAt]) {
        expect(Math.abs(date.getTime() - MAINTENANT.getTime())).toBeLessThan(
          14 * JOUR,
        );
      }
    }
  });

  it('donne le même état deux fois de suite', async () => {
    await semer(prisma, COMPTES, { maintenant: MAINTENANT });
    const premier = await photographier();

    await semer(prisma, COMPTES, { maintenant: MAINTENANT });

    expect(await photographier()).toEqual(premier);
  });

  it('retrouve un Compte réel sans toucher à son sujet ni à ses Sessions', async () => {
    const reel = await prisma.user.upsert({
      where: { email: ADRESSE_A },
      create: {
        subject: 'sujet-authentik-a',
        email: ADRESSE_A,
        householdId: ID_FOYER,
      },
      update: { subject: 'sujet-authentik-a' },
    });
    await prisma.session.create({
      data: {
        tokenHash: `empreinte-${Date.now()}`,
        userId: reel.id,
        expiresAt: new Date(MAINTENANT.getTime() + JOUR),
      },
    });

    await semer(prisma, COMPTES, { maintenant: MAINTENANT });

    const relu = await prisma.user.findUniqueOrThrow({
      where: { email: ADRESSE_A },
      include: { sessions: true },
    });
    expect(relu).toMatchObject({ id: reel.id, subject: 'sujet-authentik-a' });
    expect(relu.sessions).toHaveLength(1);
    expect(await prisma.household.count()).toBe(1);
  });

  it("vide les données métier qu'un semis précédent n'a pas posées", async () => {
    await semer(prisma, COMPTES, { maintenant: MAINTENANT });
    const avant = await photographier();

    await lireSousPortee(() =>
      prisma.event.create({
        data: {
          title: 'Saisi à la main sur le staging',
          startsAt: MAINTENANT,
          category: 'OTHER',
          scopeId: ID_ESPACE_FOYER,
        },
      }),
    );

    await semer(prisma, COMPTES, { maintenant: MAINTENANT });

    expect(await photographier()).toEqual(avant);
  });

  it('borne chaque semeur aux Espaces que son module accepte', async () => {
    const foyerSeul: Semeur = {
      module: 'foyer-seul',
      modeles: [],
      espaces: ['HOUSEHOLD'],
      async semer(client, demo) {
        await client.project.create({
          data: { title: 'Égaré', scopeId: demo.a.espacePersonnel },
        });
        return 1;
      },
    };

    await expect(
      semer(prisma, COMPTES, { maintenant: MAINTENANT, semeurs: [foyerSeul] }),
    ).rejects.toMatchObject({ raison: 'type-refuse' });
  });

  async function espacePersonnelDe(email: string): Promise<string> {
    const { personalScope } = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { personalScope: { select: { id: true } } },
    });
    if (!personalScope) {
      throw new Error(`${email} n'a pas d'Espace personnel.`);
    }
    return personalScope.id;
  }

  /**
   * Une requête Prisma ne part qu'au moment où on l'attend : elle doit donc
   * l'être **dans** la portée, pas après en être sortie.
   */
  async function lireSousPortee<T>(requete: () => PromiseLike<T>): Promise<T> {
    return sousPortee(await tousLesEspaces(), async () => await requete());
  }

  async function tousLesEspaces(): Promise<PorteeEspace> {
    const espaces = await prisma.scope.findMany({
      select: { id: true, kind: true },
    });
    return { espaces, typesAcceptes: ['PERSONAL', 'HOUSEHOLD'] };
  }

  /**
   * L'état observable du jeu, sans ce qui change par nature d'un semis à
   * l'autre : les identifiants et les dates de création des rangées semées.
   */
  async function photographier(): Promise<unknown> {
    const comptes = await prisma.user.findMany({
      select: { id: true, email: true, subject: true },
      orderBy: { email: 'asc' },
    });
    const espaces = await prisma.scope.findMany({
      select: { id: true, kind: true, label: true, holderId: true },
      orderBy: { id: 'asc' },
    });
    const evenements = await lireSousPortee(() =>
      prisma.event.findMany({
        select: {
          title: true,
          startsAt: true,
          endsAt: true,
          category: true,
          reminderLeadMinutes: true,
          scopeId: true,
        },
        orderBy: [{ startsAt: 'asc' }, { title: 'asc' }],
      }),
    );
    const projets = await lireSousPortee(() =>
      prisma.project.findMany({
        select: {
          title: true,
          notes: true,
          scopeId: true,
          expenses: {
            select: { label: true, amountCents: true, spentOn: true },
          },
        },
        orderBy: [{ scopeId: 'asc' }, { title: 'asc' }],
      }),
    );
    const repas = await lireSousPortee(() =>
      prisma.mealPlanEntry.findMany({
        select: {
          day: true,
          moment: true,
          title: true,
          guestCount: true,
          recipe: { select: { title: true } },
        },
        orderBy: [{ day: 'asc' }, { moment: 'asc' }],
      }),
    );
    const articles = await lireSousPortee(() =>
      prisma.shoppingListItem.findMany({
        select: { label: true, quantity: true, checked: true, position: true },
        orderBy: { position: 'asc' },
      }),
    );
    const stock = await lireSousPortee(() =>
      prisma.pantryItem.findMany({
        select: { quantity: true, expiresOn: true, ingredientId: true },
        orderBy: { ingredientId: 'asc' },
      }),
    );

    return { comptes, espaces, evenements, projets, repas, articles, stock };
  }
});
