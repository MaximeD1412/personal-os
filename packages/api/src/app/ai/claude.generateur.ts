import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Logger } from '@nestjs/common';
import {
  FournisseurIA,
  PanneDuFournisseur,
  type AppelIA,
  type ReponseIA,
} from './fournisseur-ia';

const journal = new Logger('ClaudeGenerateur');

/**
 * L'adaptateur de l'API Claude d'Anthropic. Il demande une sortie structurée
 * (`output_config.format`), qui contraint le modèle au schéma JSON déduit du
 * schéma zod ; le port la valide quand même ensuite, sans se fier au
 * fournisseur.
 *
 * La requête ne porte **jamais** d'outil : le modèle produit des données,
 * l'application décide (risque SEC-6). Elle est diffusée en flux, puis
 * rassemblée : un `max_tokens` élevé ne bute pas sur le délai d'une requête
 * simple.
 *
 * Aucun repli sur un autre modèle en cas de refus : le plafond se calcule sur
 * le tarif du modèle configuré, et un refus n'est qu'une sortie invalide de
 * plus pour le port.
 */
export class ClaudeGenerateur extends FournisseurIA {
  constructor(
    private readonly client: Anthropic,
    readonly modele: string,
  ) {
    super();
  }

  async appeler(appel: AppelIA): Promise<ReponseIA> {
    const { type, schema } = zodOutputFormat(appel.schema);

    let message: Anthropic.Message;
    try {
      message = await this.client.messages
        .stream({
          model: this.modele,
          max_tokens: appel.maxTokens,
          system: appel.systeme,
          messages: [{ role: 'user', content: appel.message }],
          output_config: { format: { type, schema } },
        })
        .finalMessage();
    } catch (erreur) {
      if (erreur instanceof Anthropic.APIError) {
        journal.error(`${appel.but} : ${erreur.message}`, erreur.stack);
        throw new PanneDuFournisseur(erreur.message);
      }
      throw erreur;
    }

    const { usage } = message;
    return {
      modele: message.model,
      texte: message.content
        .flatMap((bloc) => (bloc.type === 'text' ? [bloc.text] : []))
        .join(''),
      jetonsEntree:
        usage.input_tokens +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0),
      jetonsSortie: usage.output_tokens,
    };
  }
}
