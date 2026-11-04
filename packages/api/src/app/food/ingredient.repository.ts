import { Injectable } from '@nestjs/common';
import type { Allergen, CanonicalUnit } from '@personal-os/contracts';
import {
  ID_ESPACE_FOYER,
  PrismaService,
  sousPortee,
} from '@personal-os/database';
import type { IngredientAFusionner, PlanDeFusion } from './fusion/fusionner';
import type { LigneDeStock } from './stock/recaler';

export interface IngredientRecord {
  id: string;
  name: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: number | null;
  allergens: Allergen[];
  perishable: boolean;
  preferredProductId: string | null;
  createdAt: Date;
}

/** Ce qu'une écriture pose : la saisie du contrat, et le nom qu'on en déduit. */
export interface IngredientWrite {
  name: string;
  displayName: string;
  canonicalUnit: CanonicalUnit;
  gramsPerPiece: number | null;
  allergens: Allergen[];
  perishable: boolean;
}

/** La rangée telle que Prisma la rend : le poids à la pièce y est un décimal. */
type RangeeIngredient = Omit<IngredientRecord, 'gramsPerPiece'> & {
  gramsPerPiece: { toNumber(): number } | null;
};

/** Un Ingrédient tel que la fusion le lit : sa version, pour n'écrire que sur lui. */
export interface IngredientLuPourFusion extends IngredientAFusionner {
  updatedAt: Date;
}

/**
 * Le stock, les Préférences et les lignes qui citent un Ingrédient vivent dans
 * l'Espace foyer : la fusion, appelée par le catalogue hors Espace, y pose
 * elle-même sa portée.
 */
const SOUS_L_ESPACE_FOYER = {
  espaces: [{ id: ID_ESPACE_FOYER, kind: 'HOUSEHOLD' as const }],
  typesAcceptes: ['HOUSEHOLD' as const],
};

/**
 * `Ingredient` est hors Espace (`MODELES_HORS_ESPACE`) : la garde le laisse
 * passer, et aucun filtre d'Espace n'a de sens ici.
 */
@Injectable()
export class IngredientRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Les Ingrédients dont le nom contient chacun des mots, tous sans mots. */
  async lister(mots: readonly string[]): Promise<IngredientRecord[]> {
    const rangees = await this.prisma.ingredient.findMany({
      where: { AND: mots.map((mot) => ({ name: { contains: mot } })) },
      orderBy: { name: 'asc' },
    });

    return rangees.map(enIngredient);
  }

  async lire(id: string): Promise<IngredientRecord | null> {
    const rangee = await this.prisma.ingredient.findUnique({ where: { id } });

    return rangee ? enIngredient(rangee) : null;
  }

  async creer(saisie: IngredientWrite): Promise<IngredientRecord> {
    return enIngredient(await this.prisma.ingredient.create({ data: saisie }));
  }

  /**
   * Pose le Produit préféré, ou l'ôte. Que le Produit soit l'un de ceux de
   * l'Ingrédient se juge avant, au service.
   */
  async preferer(
    id: string,
    preferredProductId: string | null,
  ): Promise<IngredientRecord> {
    return enIngredient(
      await this.prisma.ingredient.update({
        where: { id },
        data: { preferredProductId },
      }),
    );
  }

  async modifier(
    id: string,
    saisie: Partial<IngredientWrite>,
  ): Promise<IngredientRecord> {
    return enIngredient(
      await this.prisma.ingredient.update({ where: { id }, data: saisie }),
    );
  }

  /** Ce que la fusion lit d'un Ingrédient, ou rien s'il n'est pas au catalogue. */
  async aFusionner(id: string): Promise<IngredientLuPourFusion | null> {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        canonicalUnit: true,
        preferredProductId: true,
        updatedAt: true,
      },
    });
    if (!ingredient) return null;

    const [ligne, preferences] = await sousPortee(
      SOUS_L_ESPACE_FOYER,
      // Attendues ici : une requête Prisma ne part qu'à son premier `then`, et
      // partirait sinon hors de cette portée.
      async () =>
        await Promise.all([
          this.prisma.pantryItem.findUnique({
            where: {
              scopeId_ingredientId: {
                scopeId: ID_ESPACE_FOYER,
                ingredientId: id,
              },
            },
            select: { quantity: true, expiresOn: true },
          }),
          this.prisma.foodPreference.findMany({
            where: { ingredientId: id },
            select: { id: true, userId: true, kind: true },
          }),
        ]),
    );

    return {
      ...ingredient,
      stock: ligne && {
        quantite: ligne.quantity.toString(),
        expireLe: enJour(ligne.expiresOn),
      },
      preferences,
    };
  }

  /** L'Ingrédient dont un Alias porte ce libellé, s'il y en a un. */
  async proprietaireDeLAlias(label: string): Promise<string | null> {
    const alias = await this.prisma.ingredientAlias.findUnique({
      where: { label },
      select: { ingredientId: true },
    });
    return alias?.ingredientId ?? null;
  }

  /**
   * La fusion en une seule écriture. Elle s'ouvre sur les deux Ingrédients
   * **tels que la fusion les a lus**, verrouillés dans l'ordre de leur
   * identifiant : un changement de l'un ou de l'autre entre-temps fait échouer
   * le tout (P2025), et le service recommence sur ce qu'il relit. Deux fusions
   * qui touchent les mêmes Ingrédients (A dans B et B dans A) les verrouillent
   * ainsi dans le même ordre : la seconde attend la première, puis échoue sur
   * sa version, au lieu de s'interbloquer avec elle.
   *
   * Chaque ligne de stock ne s'écrit que si elle a encore l'état lu (P2025
   * aussi), et l'Alias du nom du doublon que s'il a encore le propriétaire lu
   * (P2025, ou P2002 s'il est apparu). Une ligne de stock, une Préférence ou
   * une référence au doublon apparue entre-temps fait échouer l'unicité
   * (P2002) ou la suppression du doublon (P2003) : le service recommence de
   * même.
   *
   * Réécrire le conservé fait grandir sa version : un Tour de génération
   * contrôlé avant la fusion n'écrit plus (CUISINE-16), pas plus que pour un
   * Compte dont une Préférence change.
   */
  async fusionner(
    doublon: IngredientLuPourFusion,
    conserve: IngredientLuPourFusion,
    plan: PlanDeFusion,
  ): Promise<IngredientRecord> {
    const repointer = {
      where: { ingredientId: doublon.id },
      data: { ingredientId: conserve.id },
    };
    const ligneDe = (
      ingredientId: string,
      { quantite, expireLe }: LigneDeStock,
    ) => ({
      scopeId_ingredientId: { scopeId: ID_ESPACE_FOYER, ingredientId },
      quantity: quantite.toString(),
      expiresOn: versLaBase(expireLe),
    });
    const { stock } = plan;

    const verrous = [
      // Le Produit préféré est unique : le doublon le lâche ici, avant que le
      // conservé ne le reprenne à la fin.
      {
        id: doublon.id,
        ecriture: this.prisma.ingredient.update({
          where: { id: doublon.id, updatedAt: doublon.updatedAt },
          data: { preferredProductId: null },
          select: { id: true },
        }),
      },
      // Réécrire le conservé tel quel suffit à le verrouiller.
      {
        id: conserve.id,
        ecriture: this.prisma.ingredient.update({
          where: { id: conserve.id, updatedAt: conserve.updatedAt },
          data: { preferredProductId: conserve.preferredProductId },
          select: { id: true },
        }),
      },
    ]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(({ ecriture }) => ecriture);
    const { alias } = plan;

    const ecritures = [
      ...verrous,
      ...(stock.type === 'REPRENDRE'
        ? [
            this.prisma.pantryItem.update({
              where: ligneDe(doublon.id, stock.avant),
              data: { ingredientId: conserve.id },
              select: { id: true },
            }),
          ]
        : []),
      ...(stock.type === 'ADDITIONNER'
        ? [
            this.prisma.pantryItem.update({
              where: ligneDe(conserve.id, stock.duConserve),
              data: {
                quantity: stock.apres.quantite.toString(),
                expiresOn: versLaBase(stock.apres.expireLe),
              },
              select: { id: true },
            }),
            this.prisma.pantryItem.delete({
              where: ligneDe(doublon.id, stock.duDoublon),
              select: { id: true },
            }),
          ]
        : []),
      this.prisma.foodPreference.deleteMany({
        where: { id: { in: plan.preferencesEnDouble } },
      }),
      this.prisma.foodPreference.updateMany(repointer),
      ...plan.comptesTouches.map((id) =>
        this.prisma.user.update({
          where: { id },
          data: { foodPreferencesVersion: { increment: 1 } },
          select: { id: true },
        }),
      ),
      this.prisma.recipeLine.updateMany(repointer),
      this.prisma.cookedMealLine.updateMany(repointer),
      this.prisma.shoppingListItem.updateMany(repointer),
      this.prisma.product.updateMany(repointer),
      this.prisma.ingredientAlias.updateMany(repointer),
      // Le nom du doublon devient un Alias du conservé. S'il en était déjà
      // un, il ne passe au conservé que s'il appartient encore au doublon ou
      // au conservé : jamais à un troisième Ingrédient.
      alias.existant
        ? this.prisma.ingredientAlias.update({
            where: {
              label: alias.libelle,
              ingredientId: { in: [doublon.id, conserve.id] },
            },
            data: { ingredientId: conserve.id },
            select: { id: true },
          })
        : this.prisma.ingredientAlias.create({
            data: { label: alias.libelle, ingredientId: conserve.id },
            select: { id: true },
          }),
      this.prisma.ingredient.delete({
        where: { id: doublon.id },
        select: { id: true },
      }),
    ];

    const resultats = await sousPortee(
      SOUS_L_ESPACE_FOYER,
      // Attendue ici : le lot ne part qu'à son premier `then`.
      async () =>
        await this.prisma.$transaction([
          ...ecritures,
          // Verrouillé depuis le début du lot : sa version n'est plus à garder.
          this.prisma.ingredient.update({
            where: { id: conserve.id },
            data: { preferredProductId: plan.produitPrefere },
          }),
        ]),
    );

    // La dernière écriture du lot est le conservé réécrit.
    return enIngredient(resultats[resultats.length - 1] as RangeeIngredient);
  }
}

function enJour(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null;
}

/** Un jour civil part en base comme le minuit UTC de ce jour, que `DATE` garde tel quel. */
function versLaBase(jour: string | null): Date | null {
  return jour === null ? null : new Date(`${jour}T00:00:00Z`);
}

function enIngredient(rangee: RangeeIngredient): IngredientRecord {
  return {
    ...rangee,
    gramsPerPiece: rangee.gramsPerPiece?.toNumber() ?? null,
  };
}
