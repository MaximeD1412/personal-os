import { Prisma } from '../generated/prisma/client';

/**
 * Le NULL SQL d'une colonne `Json?`, pour l'écrire ou le chercher. Prisma
 * distingue ce NULL de la valeur JSON `null` et refuse un `null` nu : les
 * dépôts n'ayant pas accès au client généré (ADR 0028), la valeur passe par
 * ici.
 */
export const DbNull = Prisma.DbNull;
