import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ID_ESPACE_FOYER } from '@personal-os/database';
import type { ZodType } from 'zod';
import { ErreurMetier } from '../erreurs/erreur-metier';
import { AiTraceRepository } from './ai-trace.repository';
import { FournisseurIA } from './fournisseur-ia';
import {
  GenerateurIA,
  type DemandeStructuree,
  type Structure,
} from './generateur-ia';
import { IA_CONFIG, type IAConfig } from './ia.config';
import { coutEnCentimes, debutDuMoisCivil } from './plafond';

/** La première réponse, et une seule nouvelle tentative si elle est rejetée. */
const TENTATIVES = 2;

@Injectable()
export class GenerateurIAService extends GenerateurIA {
  constructor(
    private readonly fournisseur: FournisseurIA,
    private readonly traces: AiTraceRepository,
    @Inject(IA_CONFIG) private readonly config: IAConfig,
  ) {
    super();
  }

  async genererStructure<T>(
    demande: DemandeStructuree<T>,
  ): Promise<Structure<T>> {
    for (let tentative = 1; ; tentative++) {
      const { traceId, texte } = await this.appelerEtTracer(demande);
      const valeur = lire(texte, demande.schema);

      if (valeur.valide) {
        return { valeur: valeur.donnee, traceId };
      }
      if (tentative === TENTATIVES) {
        throw new ErreurMetier(
          'ai.invalid_output',
          "La réponse de l'IA ne respecte pas la forme attendue, même après une nouvelle tentative.",
          HttpStatus.BAD_GATEWAY,
        );
      }
    }
  }

  private async appelerEtTracer<T>(
    demande: DemandeStructuree<T>,
  ): Promise<{ traceId: string; texte: string }> {
    await this.verifierLePlafond();

    const reponse = await this.fournisseur.appeler(demande);
    const trace = await this.traces.creer({
      scopeId: ID_ESPACE_FOYER,
      purpose: demande.but,
      model: reponse.modele,
      system: demande.systeme,
      input: demande.message,
      output: reponse.texte,
      inputTokens: reponse.jetonsEntree,
      outputTokens: reponse.jetonsSortie,
      costCents: coutEnCentimes(reponse, this.config),
    });

    return { traceId: trace.id, texte: reponse.texte };
  }

  /**
   * Avant chaque appel, nouvelle tentative comprise : le coût n'est connu
   * qu'après coup, le mois peut donc dépasser le plafond d'un appel, jamais
   * de deux.
   */
  private async verifierLePlafond(): Promise<void> {
    const depense = await this.traces.coutDepuis(debutDuMoisCivil());

    if (depense >= this.config.budgetMensuelCentimes) {
      throw new ErreurMetier(
        'ai.budget_exceeded',
        "Le plafond mensuel de dépense en IA est atteint : plus aucun appel jusqu'au mois prochain.",
      );
    }
  }
}

type Lecture<T> = { valide: true; donnee: T } | { valide: false };

/** Le texte brut, lu comme un JSON puis passé au schéma. */
function lire<T>(texte: string, schema: ZodType<T>): Lecture<T> {
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    return { valide: false };
  }

  const resultat = schema.safeParse(json);
  return resultat.success
    ? { valide: true, donnee: resultat.data }
    : { valide: false };
}
