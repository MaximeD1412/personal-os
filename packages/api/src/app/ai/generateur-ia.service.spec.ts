import { ID_ESPACE_FOYER } from '@personal-os/database';
import { z } from 'zod';
import { ErreurMetier } from '../erreurs/erreur-metier';
import type {
  AiTraceRecord,
  AiTraceRepository,
  AiTraceWrite,
} from './ai-trace.repository';
import { PanneDuFournisseur } from './fournisseur-ia';
import { GenerateurIAFactice } from './generateur-ia.factice';
import { GenerateurIAService } from './generateur-ia.service';
import type { IAConfig } from './ia.config';

const UN_PLAT = z.object({ plat: z.string() });

const CONFIG: IAConfig = {
  fournisseur: 'factice',
  modele: 'claude-sonnet-5-5',
  cleApi: null,
  budgetMensuelCentimes: 500,
  prixEntreeParMillionCentimes: 200,
  prixSortieParMillionCentimes: 1000,
};

/** Le journal des traces, en mémoire : la base n'a rien à prouver ici. */
class JournalEnMemoire {
  readonly traces: AiTraceRecord[] = [];

  creer = (ecriture: AiTraceWrite): Promise<AiTraceRecord> => {
    const trace = {
      ...ecriture,
      id: `trace-${this.traces.length + 1}`,
      createdAt: new Date(),
    };
    this.traces.push(trace);
    return Promise.resolve(trace);
  };

  coutDepuis = (debut: Date): Promise<number> =>
    Promise.resolve(
      this.traces
        .filter(({ createdAt }) => createdAt >= debut)
        .reduce((somme, { costCents }) => somme + costCents, 0),
    );
}

describe('GenerateurIAService', () => {
  let fournisseur: GenerateurIAFactice;
  let journal: JournalEnMemoire;
  let generateur: GenerateurIAService;

  const demande = {
    but: 'meal-plan.generate',
    systeme: 'Tu proposes des plats.',
    message: 'Un plat pour lundi.',
    schema: UN_PLAT,
    maxTokens: 1000,
  };

  function monter(config: Partial<IAConfig> = {}): void {
    generateur = new GenerateurIAService(
      fournisseur,
      journal as unknown as AiTraceRepository,
      { ...CONFIG, ...config },
    );
  }

  beforeEach(() => {
    fournisseur = new GenerateurIAFactice();
    journal = new JournalEnMemoire();
    monter();
  });

  it('rend la valeur validée et la trace de son appel', async () => {
    fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

    const resultat = await generateur.genererStructure(demande);

    expect(resultat.valeur).toEqual({ plat: 'Gratin' });
    expect(journal.traces).toHaveLength(1);
    expect(resultat.traceId).toBe(journal.traces[0].id);
  });

  it("trace la demande et la réponse brute, dans l'Espace foyer", async () => {
    fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

    await generateur.genererStructure(demande);

    expect(journal.traces[0]).toMatchObject({
      scopeId: ID_ESPACE_FOYER,
      purpose: 'meal-plan.generate',
      model: 'factice',
      system: 'Tu proposes des plats.',
      input: 'Un plat pour lundi.',
      output: '{"plat":"Gratin"}',
    });
  });

  it('estime le coût à partir des jetons et du tarif, au centime supérieur', async () => {
    fournisseur.programmer(
      'meal-plan.generate',
      { plat: 'Gratin' },
      { jetonsEntree: 10_000, jetonsSortie: 2_500 },
    );

    await generateur.genererStructure(demande);

    // 10 000 × 200 / 1 M = 2 centimes ; 2 500 × 1 000 / 1 M = 2,5 centimes.
    expect(journal.traces[0]).toMatchObject({
      inputTokens: 10_000,
      outputTokens: 2_500,
      costCents: 5,
    });
  });

  describe('une réponse qui ne respecte pas le schéma', () => {
    it('est retentée une fois, et la seconde réponse est rendue', async () => {
      fournisseur.programmer('meal-plan.generate', { plat: 42 });
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      const resultat = await generateur.genererStructure(demande);

      expect(resultat.valeur).toEqual({ plat: 'Gratin' });
      expect(resultat.traceId).toBe(journal.traces[1].id);
    });

    it('échoue en 502 ai.invalid_output après une seule nouvelle tentative', async () => {
      fournisseur.programmerTexte('meal-plan.generate', 'Voici un gratin !');
      fournisseur.programmer('meal-plan.generate', { plat: 42 });
      fournisseur.programmer('meal-plan.generate', { plat: 'Trop tard' });

      const erreur = await echec(generateur.genererStructure(demande));

      expect(erreur).toBeInstanceOf(ErreurMetier);
      expect(erreur).toMatchObject({ code: 'ai.invalid_output', status: 502 });
      expect(journal.traces.map(({ output }) => output)).toEqual([
        'Voici un gratin !',
        '{"plat":42}',
      ]);
    });

    it('laisse des traces qui disent pourquoi chaque réponse a été rejetée', async () => {
      fournisseur.programmerTexte('meal-plan.generate', 'Voici un gratin !');
      fournisseur.programmer('meal-plan.generate', { plat: 42 });

      await echec(generateur.genererStructure(demande));

      expect(journal.traces.map(({ error }) => error)).toEqual([
        expect.stringContaining('JSON'),
        expect.stringContaining('plat'),
      ]);
    });

    it("ne marque pas d'erreur la réponse retenue après une nouvelle tentative", async () => {
      fournisseur.programmer('meal-plan.generate', { plat: 42 });
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      await generateur.genererStructure(demande);

      expect(journal.traces.map(({ error }) => error)).toEqual([
        expect.stringContaining('plat'),
        null,
      ]);
    });
  });

  describe('une panne du fournisseur', () => {
    it('laisse une trace de la demande, sans jetons connus, et remonte telle quelle', async () => {
      const panne = new PanneDuFournisseur('529 overloaded_error');
      fournisseur.programmerPanne('meal-plan.generate', panne);

      const erreur = await echec(generateur.genererStructure(demande));

      expect(erreur).toBe(panne);
      expect(journal.traces).toEqual([
        expect.objectContaining({
          purpose: 'meal-plan.generate',
          model: 'factice',
          system: 'Tu proposes des plats.',
          input: 'Un plat pour lundi.',
          output: null,
          inputTokens: null,
          outputTokens: null,
          costCents: 0,
          error: '529 overloaded_error',
        }),
      ]);
    });

    it("n'est pas retentée : seule une sortie hors schéma l'est", async () => {
      fournisseur.programmerPanne(
        'meal-plan.generate',
        new PanneDuFournisseur('hors ligne'),
      );
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      await echec(generateur.genererStructure(demande));

      expect(journal.traces).toHaveLength(1);
    });
  });

  describe('le plafond mensuel', () => {
    it("refuse l'appel en 422 ai.budget_exceeded quand le mois l'a atteint", async () => {
      journal.traces.push(uneTrace({ costCents: 500 }));
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      const erreur = await echec(generateur.genererStructure(demande));

      expect(erreur).toBeInstanceOf(ErreurMetier);
      expect(erreur).toMatchObject({ code: 'ai.budget_exceeded', status: 422 });
      expect(journal.traces).toHaveLength(1);
    });

    it('laisse passer un appel tant que le mois reste sous le plafond', async () => {
      journal.traces.push(uneTrace({ costCents: 499 }));
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      await expect(generateur.genererStructure(demande)).resolves.toMatchObject(
        { valeur: { plat: 'Gratin' } },
      );
    });

    it('ne compte pas ce qui a été dépensé les mois précédents', async () => {
      journal.traces.push(
        uneTrace({
          costCents: 5_000,
          createdAt: new Date('2020-01-15T12:00:00Z'),
        }),
      );
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      await expect(generateur.genererStructure(demande)).resolves.toMatchObject(
        { valeur: { plat: 'Gratin' } },
      );
    });

    it('se vérifie aussi avant la nouvelle tentative', async () => {
      monter({ budgetMensuelCentimes: 5 });
      fournisseur.programmer(
        'meal-plan.generate',
        { plat: 42 },
        { jetonsEntree: 25_000 },
      );
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      const erreur = await echec(generateur.genererStructure(demande));

      expect(erreur).toMatchObject({ code: 'ai.budget_exceeded' });
      expect(journal.traces).toHaveLength(1);
    });

    it("ne laisse passer qu'un appel quand plusieurs arrivent ensemble près du plafond", async () => {
      journal.traces.push(uneTrace({ costCents: 499 }));
      for (let i = 0; i < 3; i++) {
        // 50 000 jetons d'entrée à 200 centimes le million : 10 centimes.
        fournisseur.programmer(
          'meal-plan.generate',
          { plat: `Plat ${i}` },
          { jetonsEntree: 50_000 },
        );
      }

      const resultats = await Promise.allSettled(
        [1, 2, 3].map(() => generateur.genererStructure(demande)),
      );

      expect(resultats.map(({ status }) => status).sort()).toEqual([
        'fulfilled',
        'rejected',
        'rejected',
      ]);
      expect(
        journal.traces.reduce((somme, { costCents }) => somme + costCents, 0),
      ).toBe(509);
    });

    it('rouvre la file après une panne : un appel suivant passe', async () => {
      fournisseur.programmerPanne(
        'meal-plan.generate',
        new PanneDuFournisseur('hors ligne'),
      );
      fournisseur.programmer('meal-plan.generate', { plat: 'Gratin' });

      const [premier, second] = await Promise.allSettled([
        generateur.genererStructure(demande),
        generateur.genererStructure(demande),
      ]);

      expect(premier.status).toBe('rejected');
      expect(second).toMatchObject({
        status: 'fulfilled',
        value: { valeur: { plat: 'Gratin' } },
      });
    });
  });
});

function uneTrace(trace: Partial<AiTraceRecord>): AiTraceRecord {
  return {
    id: 'trace-anterieure',
    scopeId: ID_ESPACE_FOYER,
    purpose: 'meal-plan.generate',
    model: 'claude-sonnet-5-5',
    system: '',
    input: '',
    output: '',
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
    error: null,
    createdAt: new Date(),
    ...trace,
  };
}

async function echec(promesse: Promise<unknown>): Promise<unknown> {
  try {
    await promesse;
  } catch (erreur) {
    return erreur;
  }
  throw new Error("L'appel devait échouer.");
}
