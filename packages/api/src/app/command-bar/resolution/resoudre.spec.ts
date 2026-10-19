import type { CommandCatalog } from '@personal-os/contracts';
import {
  GenerateurIA,
  type DemandeStructuree,
  type Structure,
} from '../../ai/generateur-ia';
import { resoudre, type SortieDuModele } from './resoudre';

const CATALOGUE: CommandCatalog = {
  actions: [
    {
      id: 'EventController_creer',
      intent: 'Créer un Événement',
      examples: ['ajoute un rendez-vous chez le dentiste jeudi à 10 h'],
      screen: '/calendrier/evenements/nouveau',
      params: {
        title: { required: true, schema: { type: 'string', minLength: 1 } },
        startsAt: {
          required: false,
          schema: { type: 'string', format: 'date-time' },
        },
        category: {
          required: false,
          schema: { type: 'string', enum: ['APPOINTMENT', 'DEADLINE'] },
        },
      },
    },
    {
      id: 'ExpenseController_lister',
      intent: 'Voir les dépenses d’une période',
      examples: ['combien ai-je dépensé en juillet ?'],
      screen: '/finances/depenses',
      params: {
        month: { required: false, schema: { type: 'string' } },
      },
    },
  ],
};

/** 20 octobre 2026, 1 h 30 à Paris : encore le 19 en UTC. */
const MAINTENANT = new Date('2026-10-19T23:30:00Z');

/** Un double du port IA : il rend la sortie programmée et garde la demande. */
class ModeleFactice extends GenerateurIA {
  demandes: DemandeStructuree<unknown>[] = [];

  constructor(private readonly sortie: SortieDuModele) {
    super();
  }

  async genererStructure<T>(
    demande: DemandeStructuree<T>,
  ): Promise<Structure<T>> {
    this.demandes.push(demande as DemandeStructuree<unknown>);
    // La sortie passe par le schéma de la demande, comme dans le vrai port.
    return { valeur: demande.schema.parse(this.sortie), traceId: 'trace' };
  }
}

function resoudreAvec(sortie: SortieDuModele, phrase = 'une phrase') {
  const modele = new ModeleFactice(sortie);
  const resolution = resoudre(phrase, {
    catalogue: CATALOGUE,
    generateur: modele,
    maintenant: MAINTENANT,
  });
  return { modele, resolution };
}

describe("La résolution d'une commande (ADR 0018)", () => {
  it("rend l'écran de l'action choisie, prérempli des paramètres donnés", async () => {
    const { resolution } = resoudreAvec({
      actionId: 'EventController_creer',
      params: [
        { name: 'title', value: 'Dentiste' },
        { name: 'startsAt', value: '2026-10-22T08:00:00Z' },
        { name: 'category', value: 'APPOINTMENT' },
      ],
      plusProche: null,
    });

    await expect(resolution).resolves.toEqual({
      kind: 'action',
      url: '/calendrier/evenements/nouveau?title=Dentiste&startsAt=2026-10-22T08%3A00%3A00Z&category=APPOINTMENT',
      ignored: [],
    });
  });

  it("retire et signale un paramètre que le schéma de l'action refuse, sans l'appliquer", async () => {
    const { resolution } = resoudreAvec({
      actionId: 'EventController_creer',
      params: [
        { name: 'title', value: 'Dentiste' },
        { name: 'startsAt', value: 'jeudi à 10 h' },
        { name: 'category', value: 'BIRTHDAY' },
      ],
      plusProche: null,
    });

    await expect(resolution).resolves.toEqual({
      kind: 'action',
      url: '/calendrier/evenements/nouveau?title=Dentiste',
      ignored: ['startsAt', 'category'],
    });
  });

  it("retire et signale un paramètre que l'action ne préremplit pas", async () => {
    const { resolution } = resoudreAvec({
      actionId: 'EventController_creer',
      params: [
        { name: 'title', value: 'Dentiste' },
        { name: 'scopeId', value: 'un-autre-espace' },
      ],
      plusProche: null,
    });

    await expect(resolution).resolves.toMatchObject({
      url: '/calendrier/evenements/nouveau?title=Dentiste',
      ignored: ['scopeId'],
    });
  });

  it("n'ajoute pas de requête à l'écran quand aucun paramètre n'est donné", async () => {
    const { resolution } = resoudreAvec({
      actionId: 'ExpenseController_lister',
      params: [],
      plusProche: null,
    });

    await expect(resolution).resolves.toMatchObject({
      kind: 'action',
      url: '/finances/depenses',
    });
  });

  it('ne propose pas une action sans un paramètre requis : elle devient la plus proche', async () => {
    const { resolution } = resoudreAvec({
      actionId: 'EventController_creer',
      params: [{ name: 'title', value: '' }],
      plusProche: null,
    });

    await expect(resolution).resolves.toEqual({
      kind: 'none',
      nearestUrl: '/calendrier/evenements/nouveau',
    });
  });

  it("dit qu'aucune action ne correspond, avec l'écran le plus proche", async () => {
    const { resolution } = resoudreAvec({
      actionId: null,
      params: [],
      plusProche: 'ExpenseController_lister',
    });

    await expect(resolution).resolves.toEqual({
      kind: 'none',
      nearestUrl: '/finances/depenses',
    });
  });

  it("dit qu'aucune action ne correspond, sans écran quand rien n'est proche", async () => {
    const { resolution } = resoudreAvec({
      actionId: null,
      params: [],
      plusProche: null,
    });

    await expect(resolution).resolves.toEqual({ kind: 'none' });
  });

  it("ne suit jamais une action que le catalogue n'a pas", async () => {
    const { resolution } = resoudreAvec({
      actionId: 'EventController_supprimer',
      params: [],
      plusProche: 'PaymentController_payer',
    });

    await expect(resolution).resolves.toEqual({ kind: 'none' });
  });

  it('demande au modèle de choisir dans le catalogue, avec la date du jour à Paris et la phrase telle quelle', async () => {
    const { modele, resolution } = resoudreAvec(
      { actionId: null, params: [], plusProche: null },
      'ajoute  dentiste jeudi 10h',
    );
    await resolution;

    const [demande] = modele.demandes;
    expect(demande.but).toBe('command-bar.resolve');
    expect(demande.message).toContain('2026-10-20');
    expect(demande.message).toContain('mardi');
    expect(demande.message).toContain('ajoute  dentiste jeudi 10h');
    for (const action of CATALOGUE.actions) {
      expect(demande.message).toContain(action.id);
      expect(demande.message).toContain(action.intent);
    }
  });
});
