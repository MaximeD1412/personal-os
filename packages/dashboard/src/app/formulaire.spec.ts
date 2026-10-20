import { convertToParamMap } from '@angular/router';
import { zEventInput, zIngredientInput } from '@personal-os/contracts';
import { erreursDeChamp, prefillDepuisRequete } from './formulaire';

describe('prefillDepuisRequete', () => {
  const prefill = (parametres: Record<string, string | string[]>) =>
    prefillDepuisRequete(zEventInput, convertToParamMap(parametres));

  it('reprend les paramètres que le schéma de l’entrée accepte', () => {
    expect(
      prefill({
        title: 'Dentiste',
        category: 'APPOINTMENT',
        startsAt: '2026-11-03T08:30:00.000Z',
        scopeId: 'espace-a',
      }),
    ).toEqual({
      valeurs: {
        title: 'Dentiste',
        category: 'APPOINTMENT',
        startsAt: '2026-11-03T08:30:00.000Z',
        scopeId: 'espace-a',
      },
      ignores: [],
    });
  });

  it('ignore et signale un paramètre que le schéma refuse', () => {
    expect(prefill({ title: 'Dentiste', category: 'FOO' })).toEqual({
      valeurs: { title: 'Dentiste' },
      ignores: ['category=FOO'],
    });
  });

  it('lit un nombre dans la chaîne de la requête', () => {
    expect(prefill({ reminderLeadMinutes: '60' }).valeurs).toEqual({
      reminderLeadMinutes: 60,
    });
    expect(prefill({ reminderLeadMinutes: '-5' }).ignores).toEqual([
      'reminderLeadMinutes=-5',
    ]);
  });

  it('lit un booléen dans la chaîne de la requête', () => {
    const ingredient = (parametres: Record<string, string>) =>
      prefillDepuisRequete(zIngredientInput, convertToParamMap(parametres));

    expect(
      ingredient({
        displayName: 'Poireau',
        canonicalUnit: 'GRAM',
        perishable: 'true',
      }),
    ).toEqual({
      valeurs: {
        displayName: 'Poireau',
        canonicalUnit: 'GRAM',
        perishable: true,
      },
      ignores: [],
    });
    expect(ingredient({ perishable: 'false' }).valeurs).toEqual({
      perishable: false,
    });
    expect(ingredient({ perishable: 'oui' }).ignores).toEqual([
      'perishable=oui',
    ]);
  });

  it('applique le schéma du champ, normalisation comprise', () => {
    expect(prefill({ title: '  Dentiste ' }).valeurs).toEqual({
      title: 'Dentiste',
    });
    expect(prefill({ title: '   ' }).ignores).toEqual(['title=   ']);
  });

  it('garde la première valeur valable d’un paramètre répété, et signale les autres', () => {
    expect(prefill({ category: ['FOO', 'APPOINTMENT', 'OTHER'] })).toEqual({
      valeurs: { category: 'APPOINTMENT' },
      ignores: ['category=FOO', 'category=OTHER'],
    });
  });

  it('ne lit pas les paramètres étrangers au schéma', () => {
    expect(prefill({ mois: '2026-10', evenement: 'event-1' })).toEqual({
      valeurs: {},
      ignores: [],
    });
  });
});

describe('erreursDeChamp', () => {
  it('range le message de chaque champ refusé sous son chemin', () => {
    expect(
      erreursDeChamp({
        status: 400,
        code: 'request.invalid',
        message: 'La requête ne respecte pas le schéma attendu.',
        fields: [
          {
            path: 'title',
            code: 'too_small',
            message: "L'intitulé est requis.",
          },
          {
            path: 'startsAt',
            code: 'invalid_format',
            message: 'Date invalide.',
          },
        ],
      }),
    ).toEqual({ title: "L'intitulé est requis.", startsAt: 'Date invalide.' });
  });

  it("ne rend rien pour une erreur qui ne vise aucun champ, ou pour l'absence d'erreur", () => {
    expect(
      erreursDeChamp({
        status: 422,
        code: 'event.period_reversed',
        message: 'La fin précède le début.',
      }),
    ).toEqual({});
    expect(erreursDeChamp(null)).toEqual({});
  });
});
