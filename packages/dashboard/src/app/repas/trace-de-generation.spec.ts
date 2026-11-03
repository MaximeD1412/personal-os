import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AiTrace } from '@personal-os/contracts';
import { BASE, ouvrirLePlanning } from '../../testing/planning';

const TRACE: AiTrace = {
  id: 'trace-1',
  scopeId: 'foyer',
  purpose: 'meal-plan.generate',
  model: 'claude-sonnet-5-5',
  inputTokens: 1200,
  outputTokens: 800,
  costCents: 4,
  error: null,
  createdAt: '2026-10-20T09:30:00.000Z',
  system: 'Tu proposes des repas pour un Foyer.',
  input: 'Créneaux : lundi dîner.',
  output: '{"propositions":[]}',
};

function texte(el: HTMLElement, test: string): string {
  return (
    el
      .querySelector(`[data-test="${test}"]`)
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

describe('La trace d’un Tour de génération', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('montre la consigne, la demande, la réponse brute, le modèle et le coût', async () => {
    const { harness, http, el } = await ouvrirLePlanning(
      '/repas/generation/traces/trace-1',
    );
    http.expectOne(`${BASE}/ai-traces/trace-1`).flush(TRACE);
    await harness.fixture.whenStable();

    expect(el().querySelector('h1')?.textContent).toContain(
      'Trace de génération',
    );
    expect(texte(el(), 'modele')).toContain('claude-sonnet-5-5');
    expect(texte(el(), 'cout')).toContain('0,04 €');
    expect(texte(el(), 'jetons')).toContain('1 200 en entrée, 800 en sortie');
    expect(texte(el(), 'consigne')).toContain(
      'Tu proposes des repas pour un Foyer.',
    );
    expect(texte(el(), 'demande')).toContain('Créneaux : lundi dîner.');
    expect(texte(el(), 'reponse')).toContain('{"propositions":[]}');
    expect(el().querySelector('[data-test="echec"]')).toBeNull();
  });

  it('dit pourquoi l’appel n’a rien rendu d’utilisable', async () => {
    const { harness, http, el } = await ouvrirLePlanning(
      '/repas/generation/traces/trace-1',
    );
    http.expectOne(`${BASE}/ai-traces/trace-1`).flush({
      ...TRACE,
      output: null,
      inputTokens: null,
      outputTokens: null,
      error: 'Le fournisseur ne répond pas.',
    } satisfies AiTrace);
    await harness.fixture.whenStable();

    expect(texte(el(), 'echec')).toContain('Le fournisseur ne répond pas.');
    expect(texte(el(), 'reponse')).toContain('Aucune réponse du modèle.');
  });

  it('affiche le message de l’API pour une trace introuvable', async () => {
    const { harness, http, el } = await ouvrirLePlanning(
      '/repas/generation/traces/inconnue',
    );
    http.expectOne(`${BASE}/ai-traces/inconnue`).flush(
      {
        status: 404,
        code: 'ai.trace_not_found',
        message: 'Aucune trace IA de cet identifiant.',
      },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Aucune trace IA de cet identifiant.');
  });
});
