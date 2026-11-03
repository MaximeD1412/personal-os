import { ID_ESPACE_FOYER, ID_FOYER } from '../lib/espace/foyer';
import { sousPortee, type PorteeEspace } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';
import { aParis, decalerLeJour, jourAParis } from './dates';
import type { CompteDeDemo, Demo, Semeur } from './seeder';
import { SEMEURS } from './seeders';

/** Les deux adresses de `DEMO_ACCOUNT_EMAILS`, dans l'ordre : A puis B. */
export type ComptesDeDemo = readonly [string, string];

export interface OptionsDuSemis {
  /** L'instant dont le jour sert d'aujourd'hui. Par défaut, l'horloge. */
  maintenant?: Date;
  /** Les semeurs à parcourir. Par défaut, ceux de tous les modules. */
  semeurs?: readonly Semeur[];
}

/** Ce que chaque module a semé, pour le journal de la commande. */
export interface BilanDuSemis {
  aujourdhui: string;
  modules: { module: string; rangees: number }[];
}

/**
 * Remet le jeu de démo dans son état connu : vide les données métier de tous
 * les Espaces, puis sème, module par module.
 *
 * Ne touche jamais au Foyer, aux Comptes ni à leurs Sessions : les deux
 * Comptes sont les Comptes réels admis par Authentik, que le semis retrouve
 * (ou crée, avant leur première connexion), pour que la connexion au staging
 * montre leurs données.
 *
 * Tout passe par la garde d'Espace, comme une requête (ADR 0028) : le semis
 * ouvre une portée, il n'a pas de client à part.
 */
export async function semer(
  prisma: PrismaService,
  comptes: ComptesDeDemo,
  options: OptionsDuSemis = {},
): Promise<BilanDuSemis> {
  const semeurs = options.semeurs ?? SEMEURS;
  const aujourdhui = jourAParis(options.maintenant ?? new Date());

  const a = await retrouverLeCompte(prisma, comptes[0]);
  const b = await retrouverLeCompte(prisma, comptes[1]);
  const demo: Demo = {
    a,
    b,
    espaceFoyer: ID_ESPACE_FOYER,
    aujourdhui,
    le: (decalage, heure) => aParis(decalerLeJour(aujourdhui, decalage), heure),
  };

  await vider(prisma, semeurs);

  const modules: BilanDuSemis['modules'] = [];
  for (const semeur of semeurs) {
    const portee: PorteeEspace = {
      espaces: [
        { id: a.espacePersonnel, kind: 'PERSONAL' },
        { id: b.espacePersonnel, kind: 'PERSONAL' },
        { id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' },
      ],
      typesAcceptes: semeur.espaces,
    };
    const rangees = await sousPortee(portee, () => semeur.semer(prisma, demo));
    modules.push({ module: semeur.module, rangees });
  }

  return { aujourdhui, modules };
}

/**
 * Le Compte d'une adresse et son Espace personnel, créés s'ils n'existent pas
 * encore. Le sujet posé à la création n'est qu'un repère : à la première
 * connexion, l'appariement retrouve le Compte par son adresse et le remplace
 * par le vrai sujet Authentik. Un Compte qui existe déjà n'est pas modifié.
 */
async function retrouverLeCompte(
  prisma: PrismaService,
  email: string,
): Promise<CompteDeDemo> {
  const user = await prisma.user.upsert({
    where: { email },
    create: { subject: `demo:${email}`, email, householdId: ID_FOYER },
    update: {},
    select: { id: true, email: true, displayName: true },
  });

  const espace = await prisma.scope.upsert({
    where: { holderId: user.id },
    create: {
      kind: 'PERSONAL',
      label: user.displayName ?? user.email,
      householdId: ID_FOYER,
      holderId: user.id,
    },
    update: {},
    select: { id: true },
  });

  return { email: user.email, userId: user.id, espacePersonnel: espace.id };
}

/**
 * Vide les modèles des semeurs, dans l'ordre inverse du semis, et dans **tous**
 * les Espaces : une donnée saisie à la main, ou laissée par un Compte qui n'est
 * plus de la démo, ne survit pas au déploiement suivant.
 */
async function vider(
  prisma: PrismaService,
  semeurs: readonly Semeur[],
): Promise<void> {
  const portee: PorteeEspace = {
    espaces: await prisma.scope.findMany({ select: { id: true, kind: true } }),
    typesAcceptes: ['PERSONAL', 'HOUSEHOLD'],
  };

  const modeles = semeurs.flatMap(({ modeles }) => modeles).reverse();
  await sousPortee(portee, async () => {
    for (const modele of modeles) {
      await delegue(prisma, modele).deleteMany({});
    }
  });
}

interface DelegueVidable {
  deleteMany(args: object): Promise<unknown>;
}

/** Le délégué Prisma d'un modèle : `Event` → `prisma.event`. */
function delegue(prisma: PrismaService, modele: string): DelegueVidable {
  const nom = modele.charAt(0).toLowerCase() + modele.slice(1);
  const trouve = (
    prisma as unknown as Record<string, DelegueVidable | undefined>
  )[nom];
  if (!trouve) {
    throw new Error(
      `PrismaService n'expose pas « ${nom} » : le semis ne peut pas vider ${modele}.`,
    );
  }
  return trouve;
}
