import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ID_ESPACE_FOYER } from '@personal-os/database';
import { prettifyError, type ZodType } from 'zod';
import { ErreurMetier } from '../erreurs/erreur-metier';
import { AiTraceRepository, type AiTraceWrite } from './ai-trace.repository';
import {
  FournisseurIA,
  PanneDuFournisseur,
  type ReponseIA,
} from './fournisseur-ia';
import {
  GenerateurIA,
  type DemandeStructuree,
  type Structure,
} from './generateur-ia';
import { IA_CONFIG, type IAConfig } from './ia.config';
import { coutEnCentimes, debutDuMoisCivil } from './plafond';

/** La première réponse, et une seule nouvelle tentative si elle est rejetée. */
const TENTATIVES = 2;

type Lecture<T> =
  | { valide: true; donnee: T }
  | { valide: false; raison: string };

@Injectable()
export class GenerateurIAService extends GenerateurIA {
  /**
   * La file des appels : un seul à la fois, du contrôle du plafond jusqu'à
   * l'enregistrement de son coût. Sans elle, deux appels lancés ensemble près
   * du plafond le verraient tous deux ouvert. Elle vaut pour le processus :
   * l'API tourne en une seule instance (`personal-os-api`).
   */
  #file: Promise<unknown> = Promise.resolve();

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
      const resultat = await this.enFile(() => this.tenter(demande));

      if (resultat.lecture.valide) {
        return { valeur: resultat.lecture.donnee, traceId: resultat.traceId };
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

  /**
   * Un appel au fournisseur, et sa trace, qu'il réponde ou non : la demande se
   * relit même quand le fournisseur est tombé en panne.
   */
  private async tenter<T>(
    demande: DemandeStructuree<T>,
  ): Promise<{ traceId: string; lecture: Lecture<T> }> {
    await this.verifierLePlafond();

    const commun = {
      scopeId: ID_ESPACE_FOYER,
      purpose: demande.but,
      system: demande.systeme,
      input: demande.message,
    };

    let reponse: ReponseIA;
    try {
      reponse = await this.fournisseur.appeler(demande);
    } catch (erreur) {
      await this.traces.creer({
        ...commun,
        model: this.fournisseur.modele,
        output: null,
        inputTokens: null,
        outputTokens: null,
        // Rien n'a été servi : rien n'est facturé.
        costCents: 0,
        error: decrirePanne(erreur),
      });
      throw erreur;
    }

    const lecture = lire(reponse.texte, demande.schema);
    const trace = await this.traces.creer({
      ...commun,
      model: reponse.modele,
      output: reponse.texte,
      inputTokens: reponse.jetonsEntree,
      outputTokens: reponse.jetonsSortie,
      costCents: coutEnCentimes(reponse, this.config),
      error: lecture.valide ? null : lecture.raison,
    } satisfies AiTraceWrite);

    return { traceId: trace.id, lecture };
  }

  /**
   * Avant chaque appel, nouvelle tentative comprise. Le coût n'est connu
   * qu'après coup, et les appels passent un par un : le mois peut dépasser le
   * plafond d'un appel, jamais de deux.
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

  /** Attend son tour dans la file ; un échec ne la bloque pas pour la suite. */
  private enFile<R>(travail: () => Promise<R>): Promise<R> {
    const tour = this.#file.then(travail, travail);
    this.#file = tour.catch(() => undefined);
    return tour;
  }
}

/** Le texte brut, lu comme un JSON puis passé au schéma. */
function lire<T>(texte: string, schema: ZodType<T>): Lecture<T> {
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    return { valide: false, raison: "La réponse n'est pas un JSON lisible." };
  }

  const resultat = schema.safeParse(json);
  return resultat.success
    ? { valide: true, donnee: resultat.data }
    : {
        valide: false,
        raison: `La réponse ne respecte pas le schéma :\n${prettifyError(resultat.error)}`,
      };
}

function decrirePanne(erreur: unknown): string {
  if (erreur instanceof PanneDuFournisseur) {
    return erreur.detail;
  }
  return erreur instanceof Error ? erreur.message : String(erreur);
}
