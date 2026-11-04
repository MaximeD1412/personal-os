import { ErreurMetier } from '../erreurs/erreur-metier';
import { planifierLaSerie, type JoursDeLaSerie } from './serie';

function codeDe(geste: () => unknown): string | undefined {
  try {
    geste();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return erreur.code;
    }
    throw erreur;
  }
  return undefined;
}

/** Avril 2029 : du lundi 2 au dimanche 29. */
const AVRIL: JoursDeLaSerie = {
  weekdays: ['TU', 'TH'],
  from: '2029-04-02',
  to: '2029-04-29',
  time: '07:15',
};

describe('planifierLaSerie', () => {
  it("pose une Séance chacun des jours choisis de la période, à l'heure de Paris", () => {
    expect(planifierLaSerie(AVRIL)).toEqual([
      '2029-04-03T05:15:00.000Z',
      '2029-04-05T05:15:00.000Z',
      '2029-04-10T05:15:00.000Z',
      '2029-04-12T05:15:00.000Z',
      '2029-04-17T05:15:00.000Z',
      '2029-04-19T05:15:00.000Z',
      '2029-04-24T05:15:00.000Z',
      '2029-04-26T05:15:00.000Z',
    ]);
  });

  it('compte le premier et le dernier jour de la période', () => {
    expect(
      planifierLaSerie({ ...AVRIL, weekdays: ['MO', 'SU'], to: '2029-04-08' }),
    ).toEqual(['2029-04-02T05:15:00.000Z', '2029-04-08T05:15:00.000Z']);
  });

  it("garde l'heure murale de part et d'autre du changement d'heure", () => {
    expect(
      planifierLaSerie({
        weekdays: ['SA'],
        from: '2029-10-20',
        to: '2029-11-03',
        time: '07:15',
      }),
    ).toEqual([
      '2029-10-20T05:15:00.000Z',
      '2029-10-27T05:15:00.000Z',
      '2029-11-03T06:15:00.000Z',
    ]);
  });

  it("refuse une heure qui n'existe pas le jour du passage à l'heure d'été", () => {
    const printemps: JoursDeLaSerie = {
      weekdays: ['SU'],
      from: '2027-03-21',
      to: '2027-04-04',
      time: '02:30',
    };

    expect(codeDe(() => planifierLaSerie(printemps))).toBe(
      'training.series_nonexistent_time',
    );
    expect(
      planifierLaSerie({ ...printemps, from: '2027-03-29', to: '2027-04-04' }),
    ).toEqual(['2027-04-04T00:30:00.000Z']);
  });

  it("accepte une heure qui existe deux fois au retour à l'heure d'hiver", () => {
    const [debut] = planifierLaSerie({
      weekdays: ['SU'],
      from: '2029-10-28',
      to: '2029-10-28',
      time: '02:30',
    });

    expect(
      new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        timeStyle: 'short',
      }).format(new Date(debut)),
    ).toBe('02:30');
  });

  it("refuse une série qui ne tombe sur aucun jour : aucune Séance n'est créée", () => {
    expect(
      codeDe(() =>
        planifierLaSerie({ ...AVRIL, weekdays: ['WE'], to: '2029-04-03' }),
      ),
    ).toBe('training.series_empty');
  });

  it('accepte cent Séances, et refuse la cent unième', () => {
    const chaqueJour: JoursDeLaSerie = {
      weekdays: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
      from: '2029-01-01',
      to: '2029-04-10',
      time: '18:00',
    };

    expect(planifierLaSerie(chaqueJour)).toHaveLength(100);
    expect(
      codeDe(() => planifierLaSerie({ ...chaqueJour, to: '2029-04-11' })),
    ).toBe('training.series_too_long');
  });

  it('refuse une période immense sans parcourir tous ses jours', () => {
    expect(
      codeDe(() =>
        planifierLaSerie({ ...AVRIL, from: '2000-01-01', to: '9999-12-31' }),
      ),
    ).toBe('training.series_too_long');
  });
});
