import { Inject, Injectable } from '@nestjs/common';
import type {
  CommandCatalog,
  CommandResolution,
  UnresolvedCommandListQuery,
  UnresolvedCommandPage,
} from '@personal-os/contracts';
import { porteeCourante } from '@personal-os/database';
import { GenerateurIA } from '../ai/generateur-ia';
import { CATALOGUE_DE_COMMANDES } from './catalogue/catalogue';
import { resoudre } from './resolution/resoudre';
import { UnresolvedCommandRepository } from './unresolved-command.repository';

/**
 * La barre de commande prépare une action, elle ne l'exécute jamais
 * (ADR 0018) : elle rend l'URL d'un formulaire prérempli, ou dit qu'elle n'a
 * pas compris. Sa seule écriture est le journal des commandes non comprises,
 * qui est la file de travail du catalogue.
 */
@Injectable()
export class CommandBarService {
  constructor(
    @Inject(CATALOGUE_DE_COMMANDES) private readonly catalogue: CommandCatalog,
    private readonly generateur: GenerateurIA,
    private readonly journal: UnresolvedCommandRepository,
  ) {}

  async resoudre(text: string): Promise<CommandResolution> {
    const scopeId = espacePersonnel();
    const resolution = await resoudre(text, {
      catalogue: this.catalogue,
      generateur: this.generateur,
      maintenant: new Date(),
      scopeId,
    });

    if (resolution.kind === 'none') {
      await this.journal.creer({ scopeId, text });
    }
    return resolution;
  }

  /** Une page, et le curseur de la suivante s'il en reste une. */
  async page({
    cursor,
    limit,
  }: UnresolvedCommandListQuery): Promise<UnresolvedCommandPage> {
    // Une commande de plus que demandé : sa présence dit qu'une page suit.
    const commandes = await this.journal.page(cursor, limit + 1);
    const items = commandes.slice(0, limit);

    return {
      items: items.map((commande) => ({
        id: commande.id,
        scopeId: commande.scopeId,
        text: commande.text,
        createdAt: commande.createdAt.toISOString(),
      })),
      nextCursor: commandes.length > limit ? items[items.length - 1].id : null,
    };
  }
}

/**
 * Le journal, comme la trace de l'appel au modèle, vit dans l'Espace
 * personnel de l'auteur de la commande : le module le pose lui-même, comme un
 * module à Espace unique (ADR 0030). C'est le seul Espace personnel que la
 * portée de la requête atteint.
 */
function espacePersonnel(): string {
  const espace = porteeCourante()?.espaces.find(
    ({ kind }) => kind === 'PERSONAL',
  );
  if (!espace) {
    throw new Error(
      "La commande n'a pas d'auteur : aucun Espace personnel dans la portée.",
    );
  }
  return espace.id;
}
