import type { Prisma } from '../generated/prisma/client';
import type { TypeEspace } from '../lib/espace/portee';
import type { PrismaService } from '../lib/prisma.service';

/** Un Compte de démo : l'un des deux Comptes réels, et son Espace personnel. */
export interface CompteDeDemo {
  email: string;
  userId: string;
  espacePersonnel: string;
}

/** Ce que le semis donne à chaque semeur : les trois Espaces, et le jour. */
export interface Demo {
  a: CompteDeDemo;
  b: CompteDeDemo;
  espaceFoyer: string;
  /** Le jour du semis, à Paris (`YYYY-MM-DD`). */
  aujourdhui: string;
  /**
   * L'instant où une horloge de Paris indique `heure` (`HH:MM`), `decalage`
   * jours après aujourd'hui. Les dates du jeu ne s'écrivent jamais en dur : le
   * staging montre toujours la semaine en cours.
   */
  le(decalage: number, heure: string): Date;
}

/**
 * Le semeur d'un module : ce qu'il possède, ce qu'il accepte, et ce qu'il
 * sème. Un ticket qui ajoute un module ajoute son semeur à `SEMEURS`.
 */
export interface Semeur {
  /** Le module Nest dont les données sont semées (`calendar`, `food`…). */
  module: string;
  /**
   * Les modèles qu'il possède, dans l'ordre où il les remplit. Le semis les
   * vide dans l'ordre inverse avant de semer : une donnée saisie à la main sur
   * le staging ne survit pas au déploiement suivant.
   */
  modeles: readonly Prisma.ModelName[];
  /**
   * Les types d'Espace que le module accepte, comme ses routes. Le semis
   * l'écrit sous une portée bornée à ceux-là : un semeur de la Cuisine qui
   * viserait un Espace personnel est refusé par la garde, comme le serait la
   * route.
   */
  espaces: readonly TypeEspace[];
  /** Sème les données du module, et rend le nombre de rangées posées. */
  semer(prisma: PrismaService, demo: Demo): Promise<number>;
}
