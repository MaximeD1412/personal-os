import { cloisonner, type OperationPrisma } from './cloisonnement';
import { ErreurDEspace } from './erreur-d-espace';
import {
  lireLeSchema,
  RELATIONS_VERS_ESPACE,
  type ModeleDeDonnees,
} from './modeles';
import { PORTEE_PUBLIQUE } from './portee';

/**
 * Le schéma de test : les Projets, leurs Présentations publiques et les Pages
 * de contenu, tels que le client Prisma les présente.
 */
const DONNEES: ModeleDeDonnees = {
  models: {
    Scope: modele({ projects: 'Project', holder: 'User' }),
    User: modele({ sessions: 'Session', personalScope: 'Scope' }),
    Session: modele({ user: 'User' }),
    Project: modele({ scope: 'Scope', presentations: 'PublicPresentation' }),
    PublicPresentation: modele({ scope: 'Scope', project: 'Project' }),
    PageContent: modele({}),
  },
};

const SCHEMA = lireLeSchema(DONNEES, RELATIONS_VERS_ESPACE);

function modele(
  relations: Record<string, string>,
): ModeleDeDonnees['models'][string] {
  return {
    fields: [
      { name: 'id', kind: 'scalar', type: 'String' },
      ...Object.entries(relations).map(([name, type]) => ({
        name,
        kind: 'object',
        type,
      })),
    ],
  };
}

function enLecturePublique(operation: OperationPrisma) {
  return cloisonner(operation, PORTEE_PUBLIQUE, SCHEMA);
}

function refus(operation: OperationPrisma): ErreurDEspace {
  try {
    enLecturePublique(operation);
  } catch (erreur) {
    if (erreur instanceof ErreurDEspace) return erreur;
    throw erreur;
  }
  throw new Error("L'opération est passée.");
}

/**
 * Le portfolio public lit sans session, donc sans Espace. Sa portée ne laisse
 * lire que des contenus publiés, et rien écrire : même un dépôt qui oublierait
 * son filtre ne servirait ni un brouillon, ni une note privée (SEC-2).
 */
describe('Lecture publique', () => {
  it("ne lit d'une Présentation publique que le publié, quel qu'en soit l'Espace", () => {
    const args = enLecturePublique({
      model: 'PublicPresentation',
      operation: 'findMany',
      args: { where: { lang: 'EN' } },
    });

    expect(args).toEqual({
      where: { lang: 'EN', AND: [{ publicationState: 'PUBLISHED' }] },
    });
  });

  it("ne lit d'une Page de contenu que le publié, même par sa clé unique", () => {
    const args = enLecturePublique({
      model: 'PageContent',
      operation: 'findUnique',
      args: { where: { slug_lang: { slug: 'about', lang: 'FR' } } },
    });

    expect(args['where']).toEqual({
      slug_lang: { slug: 'about', lang: 'FR' },
      AND: [{ publicationState: 'PUBLISHED' }],
    });
  });

  it.each(['Project', 'ProjectExpense', 'User', 'Session', 'Scope'])(
    'refuse de lire %s, qui ne se publie pas',
    (model) => {
      expect(refus({ model, operation: 'findMany', args: {} }).raison).toBe(
        'lecture-publique',
      );
    },
  );

  it.each([
    ['create', { data: { title: 'x' } }],
    ['update', { where: { id: 'p' }, data: { title: 'x' } }],
    ['updateMany', { data: { publicationState: 'PUBLISHED' } }],
    ['upsert', { where: { id: 'p' }, create: {}, update: {} }],
    ['delete', { where: { id: 'p' } }],
    ['deleteMany', {}],
  ])("n'écrit rien : %s est refusé", (operation, args) => {
    expect(refus({ model: 'PublicPresentation', operation, args }).raison).toBe(
      'lecture-publique',
    );
  });

  it("ne suit aucune relation : le Projet et ses notes restent hors d'atteinte", () => {
    for (const args of [
      { include: { project: true } },
      { select: { title: true, project: { select: { notes: true } } } },
      { where: { project: { notes: { contains: 'privé' } } } },
      { where: { OR: [{ lang: 'FR' }, { project: { is: {} } }] } },
    ]) {
      expect(
        refus({ model: 'PublicPresentation', operation: 'findMany', args })
          .raison,
      ).toBe('lecture-publique');
    }
  });

  it('laisse choisir les champs propres au contenu', () => {
    const args = enLecturePublique({
      model: 'PublicPresentation',
      operation: 'findFirst',
      args: { select: { title: true, body: true }, where: { projectId: 'p' } },
    });

    expect(args['select']).toEqual({ title: true, body: true });
  });
});
