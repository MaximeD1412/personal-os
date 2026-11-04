import type { ParamMap } from '@angular/router';
import type { ApiError } from '@personal-os/contracts';
import type * as z from 'zod';

/** Les champs d'une union, chacun avec les valeurs que ses branches lui donnent. */
export type Aplati<T> = {
  [K in T extends unknown ? keyof T : never]?: T extends unknown
    ? K extends keyof T
      ? T[K]
      : never
    : never;
};

/** Le schéma d'une saisie : un objet, ou une union discriminée d'objets. */
export type SchemaDeSaisie =
  | z.ZodObject
  | z.ZodDiscriminatedUnion<readonly z.ZodObject[]>;

/**
 * Le paramètre de requête qui nomme ce qu'un lien proposait sans pouvoir le
 * mettre : la barre de commande y passe les paramètres que le résolveur a
 * écartés (`ignored`), déjà retirés de l'URL.
 */
export const PARAMETRE_DES_ECARTES = 'ignored';

/** Ce qu'une URL apporte à un formulaire, et ce qu'elle n'a pas pu y mettre. */
export interface Prefill<T> {
  valeurs: Aplati<T>;
  /**
   * Les paramètres écartés, pour les montrer : `nom=valeur`, ou le seul nom
   * quand le lien ne porte plus la valeur (`PARAMETRE_DES_ECARTES`).
   */
  ignores: string[];
}

/**
 * Un formulaire se préremplit depuis sa requête (ADR 0030) : chaque paramètre
 * qui porte le nom d'un champ est validé par le schéma de ce champ dans le
 * contrat. Un paramètre refusé est écarté et signalé, jamais appliqué en
 * silence. Les paramètres étrangers au schéma (le mois affiché, l'Événement
 * visé) ne le concernent pas : ils ne sont ni repris ni signalés.
 *
 * Un paramètre répété ne donne qu'une valeur, la première valable : les
 * autres sont signalées. Sauf pour un champ tableau (les jours d'une série,
 * `?weekdays=TU&weekdays=TH`) : chaque répétition en est un élément, lu par
 * le schéma de l'élément, et un élément refusé ou déjà donné est signalé.
 *
 * Une union discriminée (la cible d'une Préférence alimentaire) se lit champ
 * par champ : un paramètre vaut si une des branches qui le nomment
 * l'accepte. Choisir la branche reste au formulaire.
 *
 * Les noms que porte `PARAMETRE_DES_ECARTES` sont signalés tels quels : leur
 * valeur a été refusée avant d'arriver dans l'URL.
 */
export function prefillDepuisRequete<S extends SchemaDeSaisie>(
  schema: S,
  parametres: ParamMap,
): Prefill<z.output<S>> {
  const valeurs: Record<string, unknown> = {};
  const ignores: string[] = [];

  for (const [nom, champs] of champsDe(schema)) {
    const elements = champs.flatMap((champ) => elementDe(champ) ?? []);
    if (elements.length > 0) {
      const lus: unknown[] = [];
      for (const brut of parametres.getAll(nom)) {
        const valeur = lireParUn(elements, brut);
        if (valeur === undefined || lus.includes(valeur)) {
          ignores.push(`${nom}=${brut}`);
        } else {
          lus.push(valeur);
        }
      }
      if (lus.length > 0) {
        valeurs[nom] = lus;
      }
      continue;
    }

    for (const brut of parametres.getAll(nom)) {
      const valeur = nom in valeurs ? undefined : lireParUn(champs, brut);
      if (valeur === undefined) {
        ignores.push(`${nom}=${brut}`);
      } else {
        valeurs[nom] = valeur;
      }
    }
  }
  ignores.push(...parametres.getAll(PARAMETRE_DES_ECARTES));

  return { valeurs: valeurs as Aplati<z.output<S>>, ignores };
}

/** Chaque champ du schéma, et ses schémas : un par branche qui le nomme. */
function champsDe(schema: SchemaDeSaisie): Map<string, z.ZodType[]> {
  const branches = 'options' in schema ? schema.options : [schema];
  const champs = new Map<string, z.ZodType[]>();
  for (const branche of branches) {
    for (const [nom, champ] of Object.entries(branche.shape)) {
      champs.set(nom, [...(champs.get(nom) ?? []), champ as z.ZodType]);
    }
  }
  return champs;
}

/** Le schéma d'un élément, si le champ est un tableau (même optionnel). */
function elementDe(champ: z.ZodType): z.ZodType | undefined {
  const def = champ._zod.def as {
    type: string;
    element?: z.ZodType;
    innerType?: z.ZodType;
  };
  if (def.type === 'array') {
    return def.element;
  }
  return def.type === 'optional' && def.innerType
    ? elementDe(def.innerType)
    : undefined;
}

function lireParUn(champs: readonly z.ZodType[], brut: string): unknown {
  for (const champ of champs) {
    const valeur = lire(champ, brut);
    if (valeur !== undefined) {
      return valeur;
    }
  }
  return undefined;
}

/**
 * Une requête ne porte que des chaînes : un champ numérique du contrat reçoit
 * le nombre que la chaîne écrit, un champ booléen `true` ou `false`.
 * `undefined` quand le champ refuse toutes ces lectures.
 */
function lire(champ: z.ZodType, brut: string): unknown {
  const candidats: unknown[] = [brut];
  if (/^-?\d+(\.\d+)?$/.test(brut)) {
    candidats.push(Number(brut));
  }
  if (brut === 'true' || brut === 'false') {
    candidats.push(brut === 'true');
  }

  for (const candidat of candidats) {
    const lu = champ.safeParse(candidat);
    if (lu.success && lu.data !== undefined) {
      return lu.data;
    }
  }
  return undefined;
}

/**
 * Les champs refusés par l'API, rangés par chemin : chaque message s'affiche
 * sous le champ qu'il vise. Une erreur sans `fields` n'en vise aucun.
 */
export function erreursDeChamp(
  erreur: ApiError | null | undefined,
): Record<string, string> {
  const parChemin: Record<string, string> = {};
  for (const { path, message } of erreur?.fields ?? []) {
    parChemin[path] ??= message;
  }
  return parChemin;
}
