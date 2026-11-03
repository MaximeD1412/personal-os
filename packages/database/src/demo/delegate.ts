import type { PrismaService } from '../lib/prisma.service';

interface Delegue {
  deleteMany(args: object): Promise<unknown>;
  count(): Promise<number>;
}

/** Le délégué Prisma d'un modèle : `Event` → `prisma.event`. */
export function delegue(prisma: PrismaService, modele: string): Delegue {
  const nom = modele.charAt(0).toLowerCase() + modele.slice(1);
  const trouve = (prisma as unknown as Record<string, Delegue | undefined>)[
    nom
  ];
  if (!trouve) {
    throw new Error(
      `PrismaService n'expose pas « ${nom} » : le semis ne peut pas atteindre ${modele}.`,
    );
  }
  return trouve;
}

/**
 * Les rangées des modèles d'un semeur, sous la portée courante : le bilan
 * d'un semeur qui délègue à des fonctions qui ne comptent pas.
 */
export async function compter(
  prisma: PrismaService,
  modeles: readonly string[],
): Promise<number> {
  let total = 0;
  for (const modele of modeles) {
    total += await delegue(prisma, modele).count();
  }
  return total;
}
