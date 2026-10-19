import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ErreurMetier } from '../erreurs/erreur-metier';
import { ClaudeGenerateur } from './claude.generateur';

const APPEL = {
  but: 'meal-plan.generate',
  systeme: 'Tu proposes des plats.',
  message: 'Un plat pour lundi.',
  schema: z.object({ plat: z.string() }),
  maxTokens: 2000,
};

/** Le client du SDK, remplacé : ce test n'atteint jamais le réseau. */
function unClient(reponse: () => Promise<unknown>) {
  const stream = jest.fn(() => ({ finalMessage: reponse }));
  return {
    client: { messages: { stream } } as unknown as Anthropic,
    stream,
  };
}

const UN_MESSAGE = {
  model: 'claude-sonnet-5-5',
  stop_reason: 'end_turn',
  content: [
    { type: 'thinking', thinking: '' },
    { type: 'text', text: '{"plat":' },
    { type: 'text', text: '"Gratin"}' },
  ],
  usage: {
    input_tokens: 120,
    output_tokens: 40,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
  },
};

describe('ClaudeGenerateur', () => {
  it('demande une sortie structurée au modèle configuré, sans aucun outil', async () => {
    const { client, stream } = unClient(() => Promise.resolve(UN_MESSAGE));

    await new ClaudeGenerateur(client, 'claude-sonnet-5-5').appeler(APPEL);

    const requete = (stream.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(requete).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 2000,
      system: 'Tu proposes des plats.',
      messages: [{ role: 'user', content: 'Un plat pour lundi.' }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: expect.objectContaining({
            properties: { plat: { type: 'string' } },
          }),
        },
      },
    });
    // Le modèle produit des données, l'application décide (SEC-6).
    expect(requete).not.toHaveProperty('tools');
    expect(requete).not.toHaveProperty('tool_choice');
    expect(requete).not.toHaveProperty('mcp_servers');
  });

  it('rend le texte brut, le modèle qui a répondu et ses jetons', async () => {
    const { client } = unClient(() => Promise.resolve(UN_MESSAGE));

    await expect(
      new ClaudeGenerateur(client, 'claude-sonnet-5-5').appeler(APPEL),
    ).resolves.toEqual({
      modele: 'claude-sonnet-5-5',
      texte: '{"plat":"Gratin"}',
      jetonsEntree: 120,
      jetonsSortie: 40,
    });
  });

  it("compte les jetons servis par le cache comme des jetons d'entrée", async () => {
    const { client } = unClient(() =>
      Promise.resolve({
        ...UN_MESSAGE,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_creation_input_tokens: 30,
          cache_read_input_tokens: 60,
        },
      }),
    );

    const reponse = await new ClaudeGenerateur(
      client,
      'claude-sonnet-5-5',
    ).appeler(APPEL);

    expect(reponse.jetonsEntree).toBe(100);
  });

  it('traduit une panne du fournisseur en 502 ai.provider_unavailable', async () => {
    const { client } = unClient(() =>
      Promise.reject(
        new Anthropic.APIConnectionError({ message: 'hors ligne' }),
      ),
    );

    const erreur = await new ClaudeGenerateur(client, 'claude-sonnet-5-5')
      .appeler(APPEL)
      .catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ErreurMetier);
    expect(erreur).toMatchObject({
      code: 'ai.provider_unavailable',
      status: 502,
    });
  });
});
