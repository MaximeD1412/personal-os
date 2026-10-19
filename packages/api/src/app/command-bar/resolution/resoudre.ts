import {
  aujourdhui,
  FUSEAU,
  type CommandAction,
  type CommandCatalog,
  type CommandResolution,
  type JsonSchema,
} from '@personal-os/contracts';
import { z } from 'zod';
import type { GenerateurIA } from '../../ai/generateur-ia';

/**
 * Ce que le modèle rend : l'action choisie et ses paramètres, ou aucune
 * action et, peut-être, la plus proche.
 *
 * Une seule forme d'objet plutôt qu'une union : la sortie structurée du
 * fournisseur ne connaît que des objets fermés. Les paramètres sont donc une
 * liste de paires plutôt qu'un dictionnaire, et leurs valeurs des scalaires.
 */
const zSortieDuModele = z.object({
  actionId: z.string().nullable(),
  params: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  ),
  plusProche: z.string().nullable(),
});

export type SortieDuModele = z.infer<typeof zSortieDuModele>;

export interface ContexteDeResolution {
  catalogue: CommandCatalog;
  generateur: GenerateurIA;
  maintenant: Date;
}

/** Le but des appels au modèle, qui nomme leurs traces. */
export const BUT_RESOLUTION = 'command-bar.resolve';

/**
 * La consigne : la barre prépare une action, elle ne l'exécute jamais et ne
 * répond jamais par une phrase (ADR 0018).
 */
const CONSIGNE = [
  "Tu traduis une commande, écrite en français par l'utilisateur d'une application personnelle, en une action de son catalogue.",
  "Tu ne choisis jamais une action absente du catalogue, et tu ne réponds jamais à la commande : l'action ouvre un formulaire prérempli que l'utilisateur relit et confirme. Une question se traduit par l'action qui ouvre l'écran portant la réponse, si le catalogue en a une.",
  'Tu ne remplis un paramètre que si la commande le donne. Une ambiguïté (cette occurrence ou toute la série, quel jour) ne se devine pas : laisse le paramètre vide, le formulaire posera la question.',
  "Un paramètre respecte le schéma JSON que le catalogue lui donne. Un jour s'écrit YYYY-MM-DD. Un instant s'écrit en UTC, au format ISO-8601 terminé par Z : l'heure dite par l'utilisateur est celle de Paris, dont le décalage du moment est donné.",
  "Si aucune action ne correspond, actionId est vide ; plusProche nomme alors l'action la plus proche, ou reste vide si aucune ne l'est.",
].join('\n\n');

/**
 * `(phrase, catalogue) → action préremplie | échec explicite` (ADR 0018).
 *
 * Le modèle choisit une action du catalogue et en propose les paramètres ;
 * chacun passe ensuite par le schéma que l'API lui donne. Un paramètre refusé
 * est retiré et signalé, jamais appliqué. Le résolveur ne connaît que des
 * écrans à ouvrir : il n'appelle aucune route, et n'écrit donc rien.
 */
export async function resoudre(
  phrase: string,
  { catalogue, generateur, maintenant }: ContexteDeResolution,
): Promise<CommandResolution> {
  const { valeur: sortie } = await generateur.genererStructure({
    but: BUT_RESOLUTION,
    systeme: CONSIGNE,
    message: demande(phrase, catalogue, maintenant),
    schema: zSortieDuModele,
    maxTokens: 1000,
  });

  const trouver = (id: string | null) =>
    catalogue.actions.find((action) => action.id === id);

  const action = trouver(sortie.actionId);
  if (!action) {
    const proche = trouver(sortie.plusProche);
    return proche
      ? { kind: 'none', nearestUrl: proche.screen }
      : { kind: 'none' };
  }

  return preremplir(action, sortie.params);
}

/** La demande : le jour à Paris, le catalogue, et la phrase telle quelle. */
function demande(
  phrase: string,
  catalogue: CommandCatalog,
  maintenant: Date,
): string {
  const jourDeLaSemaine = new Intl.DateTimeFormat('fr-FR', {
    timeZone: FUSEAU,
    weekday: 'long',
  }).format(maintenant);
  const decalage = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSEAU,
    timeZoneName: 'longOffset',
  })
    .formatToParts(maintenant)
    .find(({ type }) => type === 'timeZoneName')?.value;

  return JSON.stringify(
    {
      aujourdhui: {
        jour: aujourdhui(FUSEAU, maintenant),
        jourDeLaSemaine,
        decalageDeParis: decalage?.replace('GMT', '') || '+00:00',
      },
      catalogue: catalogue.actions.map(({ id, intent, examples, params }) => ({
        id,
        intent,
        examples,
        params,
      })),
      commande: phrase,
    },
    null,
    2,
  );
}

/**
 * Valide chaque paramètre proposé par le schéma que l'action lui donne. Une
 * action dont un paramètre requis manque n'est pas proposée : elle devient la
 * plus proche.
 */
function preremplir(
  action: CommandAction,
  params: SortieDuModele['params'],
): CommandResolution {
  const query = new URLSearchParams();
  const ignored: string[] = [];

  for (const { name, value } of params) {
    const champ = Object.prototype.hasOwnProperty.call(action.params, name)
      ? action.params[name]
      : undefined;
    if (!champ || query.has(name) || !respecte(champ.schema, value)) {
      ignored.push(name);
      continue;
    }
    query.set(name, String(value));
  }

  const requisAbsent = Object.entries(action.params).some(
    ([nom, { required }]) => required && !query.has(nom),
  );
  if (requisAbsent) {
    return { kind: 'none', nearestUrl: action.screen };
  }

  const requete = query.toString();
  return {
    kind: 'action',
    url: requete ? `${action.screen}?${requete}` : action.screen,
    ignored,
  };
}

/** Un schéma que zod ne sait pas lire refuse la valeur : rien n'est appliqué au hasard. */
function respecte(schema: JsonSchema, valeur: unknown): boolean {
  try {
    return z.fromJSONSchema(schema).safeParse(valeur).success;
  } catch {
    return false;
  }
}
