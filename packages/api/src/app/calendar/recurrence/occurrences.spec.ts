import type { Recurrence } from '@personal-os/contracts';
import {
  occurrences,
  type EvenementRecurrent,
  type ExceptionDOccurrence,
  type Occurrence,
} from './occurrences';

/*
 * Les instants sont écrits en UTC, l'heure de Paris en commentaire. En 2026,
 * Paris passe à l'heure d'été le dimanche 29 mars (UTC+1 → UTC+2) et revient
 * à l'heure d'hiver le dimanche 25 octobre.
 */

const instant = (iso: string) => new Date(iso);

const periode = (debut: string, fin: string) => ({
  debut: instant(debut),
  fin: instant(fin),
});

function evenement(
  champs: Partial<Omit<EvenementRecurrent, 'startsAt' | 'endsAt'>> & {
    startsAt: string;
    endsAt?: string | null;
  },
): EvenementRecurrent {
  return {
    title: 'Réunion',
    recurrence: null,
    ...champs,
    startsAt: instant(champs.startsAt),
    endsAt: champs.endsAt ? instant(champs.endsAt) : null,
  };
}

function regle(champs: Partial<Recurrence>): Recurrence {
  return { freq: 'DAILY', interval: 1, ...champs };
}

function annulee(originalStart: string): ExceptionDOccurrence {
  return {
    originalStart: instant(originalStart),
    kind: 'CANCELLED',
    startsAt: null,
    endsAt: null,
    title: null,
  };
}

function modifiee(
  originalStart: string,
  champs: { startsAt?: string; endsAt?: string; title?: string },
): ExceptionDOccurrence {
  return {
    originalStart: instant(originalStart),
    kind: 'MODIFIED',
    startsAt: champs.startsAt ? instant(champs.startsAt) : null,
    endsAt: champs.endsAt ? instant(champs.endsAt) : null,
    title: champs.title ?? null,
  };
}

/** Les débuts, en ISO : ce que la plupart des cas ont à comparer. */
const debuts = (rendues: Occurrence[]) =>
  rendues.map(({ startsAt }) => startsAt.toISOString());

describe('occurrences', () => {
  describe("Un Événement qui n'a lieu qu'une fois", () => {
    const DENTISTE = evenement({
      title: 'Dentiste',
      startsAt: '2026-09-14T07:30:00.000Z',
      endsAt: '2026-09-14T08:00:00.000Z',
    });

    it("n'a qu'une occurrence, identifiée par son début", () => {
      expect(
        occurrences(
          DENTISTE,
          [],
          periode('2026-09-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z'),
        ),
      ).toEqual([
        {
          originalStart: instant('2026-09-14T07:30:00.000Z'),
          startsAt: instant('2026-09-14T07:30:00.000Z'),
          endsAt: instant('2026-09-14T08:00:00.000Z'),
          title: 'Dentiste',
        },
      ]);
    });

    it("n'en a aucune hors de la période", () => {
      expect(
        occurrences(
          DENTISTE,
          [],
          periode('2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
        ),
      ).toEqual([]);
    });
  });

  describe('Les fréquences', () => {
    it('répète un Événement quotidien chaque jour, ou tous les n jours', () => {
      const tousLesDeuxJours = evenement({
        startsAt: '2026-09-14T07:00:00.000Z', // lundi 9 h
        recurrence: regle({ freq: 'DAILY', interval: 2 }),
      });

      expect(
        debuts(
          occurrences(
            tousLesDeuxJours,
            [],
            periode('2026-09-14T00:00:00.000Z', '2026-09-20T23:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2026-09-14T07:00:00.000Z',
        '2026-09-16T07:00:00.000Z',
        '2026-09-18T07:00:00.000Z',
        '2026-09-20T07:00:00.000Z',
      ]);
    });

    it('filtre une série quotidienne par jours de la semaine : les jours ouvrés', () => {
      const ouvres = evenement({
        startsAt: '2026-09-14T07:00:00.000Z', // lundi
        recurrence: regle({
          freq: 'DAILY',
          byWeekday: ['MO', 'TU', 'WE', 'TH', 'FR'],
        }),
      });

      expect(
        debuts(
          occurrences(
            ouvres,
            [],
            periode('2026-09-17T00:00:00.000Z', '2026-09-22T23:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2026-09-17T07:00:00.000Z', // jeudi
        '2026-09-18T07:00:00.000Z', // vendredi
        '2026-09-21T07:00:00.000Z', // lundi
        '2026-09-22T07:00:00.000Z', // mardi
      ]);
    });

    it("s'arrête à la période quand aucun jour parcouru ne tombe sur ceux de la règle", () => {
      // Tous les sept jours depuis un lundi : jamais un mardi. Le parcours
      // doit s'arrêter à la fin de la période, et ne rendre que le début.
      const jamaisUnMardi = evenement({
        startsAt: '2026-09-14T07:00:00.000Z',
        recurrence: regle({ freq: 'DAILY', interval: 7, byWeekday: ['TU'] }),
      });

      expect(
        debuts(
          occurrences(
            jamaisUnMardi,
            [],
            periode('2026-09-01T00:00:00.000Z', '2027-09-30T00:00:00.000Z'),
          ),
        ),
      ).toEqual(['2026-09-14T07:00:00.000Z']);
    });

    it('répète un Événement hebdomadaire le jour de son début', () => {
      const chaqueLundi = evenement({
        startsAt: '2026-09-14T07:00:00.000Z',
        recurrence: regle({ freq: 'WEEKLY' }),
      });

      expect(
        debuts(
          occurrences(
            chaqueLundi,
            [],
            periode('2026-09-15T00:00:00.000Z', '2026-10-05T23:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2026-09-21T07:00:00.000Z',
        '2026-09-28T07:00:00.000Z',
        '2026-10-05T07:00:00.000Z',
      ]);
    });

    it('répète un Événement hebdomadaire sur ses jours, une semaine sur deux', () => {
      const lundiEtJeudi = evenement({
        startsAt: '2026-09-14T07:00:00.000Z', // lundi
        recurrence: regle({
          freq: 'WEEKLY',
          interval: 2,
          byWeekday: ['TH', 'MO'],
        }),
      });

      expect(
        debuts(
          occurrences(
            lundiEtJeudi,
            [],
            periode('2026-09-14T00:00:00.000Z', '2026-10-04T23:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2026-09-14T07:00:00.000Z', // lundi
        '2026-09-17T07:00:00.000Z', // jeudi
        '2026-09-28T07:00:00.000Z', // lundi, deux semaines plus tard
        '2026-10-01T07:00:00.000Z', // jeudi
      ]);
    });

    it('garde le début comme première occurrence, même hors des jours de la règle', () => {
      // iCalendar : le début compte toujours pour la première occurrence.
      const depuisUnMercredi = evenement({
        startsAt: '2026-09-16T07:00:00.000Z', // mercredi
        recurrence: regle({ freq: 'WEEKLY', byWeekday: ['MO'] }),
      });

      expect(
        debuts(
          occurrences(
            depuisUnMercredi,
            [],
            periode('2026-09-14T00:00:00.000Z', '2026-09-27T23:00:00.000Z'),
          ),
        ),
      ).toEqual(['2026-09-16T07:00:00.000Z', '2026-09-21T07:00:00.000Z']);
    });

    it('répète un Événement mensuel le même jour, et saute les mois qui ne l’ont pas', () => {
      const leTrenteEtUn = evenement({
        startsAt: '2027-01-31T08:00:00.000Z', // 31 janvier, 9 h
        recurrence: regle({ freq: 'MONTHLY' }),
      });

      expect(
        debuts(
          occurrences(
            leTrenteEtUn,
            [],
            periode('2027-01-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2027-01-31T08:00:00.000Z',
        '2027-03-31T07:00:00.000Z', // l'heure d'été est passée : toujours 9 h
        '2027-05-31T07:00:00.000Z',
      ]);
    });

    it('répète un Événement annuel, un 29 février les seules années bissextiles', () => {
      const anniversaire = evenement({
        startsAt: '2028-02-29T00:00:00.000Z', // 29 février, 1 h
        recurrence: regle({ freq: 'YEARLY' }),
      });

      expect(
        debuts(
          occurrences(
            anniversaire,
            [],
            periode('2028-01-01T00:00:00.000Z', '2036-12-31T00:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2028-02-29T00:00:00.000Z',
        '2032-02-29T00:00:00.000Z',
        '2036-02-29T00:00:00.000Z',
      ]);
    });

    it('répète un Événement annuel tous les n ans', () => {
      const tousLesDeuxAns = evenement({
        startsAt: '2026-09-14T07:00:00.000Z',
        recurrence: regle({ freq: 'YEARLY', interval: 2 }),
      });

      expect(
        debuts(
          occurrences(
            tousLesDeuxAns,
            [],
            periode('2026-01-01T00:00:00.000Z', '2031-01-01T00:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2026-09-14T07:00:00.000Z',
        '2028-09-14T07:00:00.000Z',
        '2030-09-14T07:00:00.000Z',
      ]);
    });
  });

  describe("Le changement d'heure", () => {
    it('garde une réunion à 9 h au passage à l’heure d’été, fin mars', () => {
      const reunion = evenement({
        startsAt: '2026-03-27T08:00:00.000Z', // vendredi 9 h (UTC+1)
        endsAt: '2026-03-27T09:00:00.000Z', // 10 h
        recurrence: regle({ freq: 'DAILY' }),
      });

      const rendues = occurrences(
        reunion,
        [],
        periode('2026-03-27T00:00:00.000Z', '2026-03-30T22:00:00.000Z'),
      );

      expect(
        rendues.map(({ startsAt, endsAt }) => [
          startsAt.toISOString(),
          endsAt?.toISOString(),
        ]),
      ).toEqual([
        ['2026-03-27T08:00:00.000Z', '2026-03-27T09:00:00.000Z'],
        ['2026-03-28T08:00:00.000Z', '2026-03-28T09:00:00.000Z'],
        ['2026-03-29T07:00:00.000Z', '2026-03-29T08:00:00.000Z'], // UTC+2
        ['2026-03-30T07:00:00.000Z', '2026-03-30T08:00:00.000Z'],
      ]);
    });

    it('garde une réunion à 9 h au retour à l’heure d’hiver, fin octobre', () => {
      const reunion = evenement({
        startsAt: '2026-10-19T07:00:00.000Z', // lundi 9 h (UTC+2)
        recurrence: regle({ freq: 'WEEKLY' }),
      });

      expect(
        debuts(
          occurrences(
            reunion,
            [],
            periode('2026-10-19T00:00:00.000Z', '2026-11-02T23:00:00.000Z'),
          ),
        ),
      ).toEqual([
        '2026-10-19T07:00:00.000Z',
        '2026-10-26T08:00:00.000Z', // UTC+1
        '2026-11-02T08:00:00.000Z',
      ]);
    });

    it("place une heure qui n'existe pas avec le décalage d'avant le saut", () => {
      // 2 h 30 n'existe pas le 29 mars : iCalendar la lit en UTC+1, soit 3 h 30.
      const deuxHeuresEtDemie = evenement({
        startsAt: '2026-03-28T01:30:00.000Z',
        recurrence: regle({ freq: 'DAILY' }),
      });

      expect(
        debuts(
          occurrences(
            deuxHeuresEtDemie,
            [],
            periode('2026-03-29T00:00:00.000Z', '2026-03-30T23:00:00.000Z'),
          ),
        ),
      ).toEqual(['2026-03-29T01:30:00.000Z', '2026-03-30T00:30:00.000Z']);
    });

    it('place une heure qui existe deux fois à la première', () => {
      // 2 h 30 a lieu deux fois le 25 octobre : iCalendar prend la première.
      const deuxHeuresEtDemie = evenement({
        startsAt: '2026-10-24T00:30:00.000Z',
        recurrence: regle({ freq: 'DAILY' }),
      });

      expect(
        debuts(
          occurrences(
            deuxHeuresEtDemie,
            [],
            periode('2026-10-25T00:00:00.000Z', '2026-10-26T23:00:00.000Z'),
          ),
        ),
      ).toEqual(['2026-10-25T00:30:00.000Z', '2026-10-26T01:30:00.000Z']);
    });
  });

  describe('La fin de la série', () => {
    const DEPUIS_LE_14 = '2026-09-14T07:00:00.000Z';
    const SEPTEMBRE = periode(
      '2026-09-01T00:00:00.000Z',
      '2026-09-30T21:59:59.999Z',
    );

    it("s'arrête au jour `until`, qu'elle inclut", () => {
      const jusquAu17 = evenement({
        startsAt: DEPUIS_LE_14,
        recurrence: regle({ until: '2026-09-17' }),
      });

      expect(debuts(occurrences(jusquAu17, [], SEPTEMBRE))).toEqual([
        '2026-09-14T07:00:00.000Z',
        '2026-09-15T07:00:00.000Z',
        '2026-09-16T07:00:00.000Z',
        '2026-09-17T07:00:00.000Z',
      ]);
    });

    it('lit `until` comme un jour de Paris, pas comme un jour UTC', () => {
      // Minuit et demi à Paris le 15, c'est encore le 14 en UTC.
      const aMinuitEtDemie = evenement({
        startsAt: '2026-09-13T22:30:00.000Z',
        recurrence: regle({ until: '2026-09-15' }),
      });

      expect(debuts(occurrences(aMinuitEtDemie, [], SEPTEMBRE))).toEqual([
        '2026-09-13T22:30:00.000Z',
        '2026-09-14T22:30:00.000Z',
      ]);
    });

    it('s’arrête après `count` occurrences, la première comprise', () => {
      const troisFois = evenement({
        startsAt: DEPUIS_LE_14,
        recurrence: regle({ freq: 'WEEKLY', count: 3 }),
      });

      expect(debuts(occurrences(troisFois, [], SEPTEMBRE))).toEqual([
        '2026-09-14T07:00:00.000Z',
        '2026-09-21T07:00:00.000Z',
        '2026-09-28T07:00:00.000Z',
      ]);
    });

    it('compte dans `count` les occurrences qui précèdent la période', () => {
      const cinqFois = evenement({
        startsAt: DEPUIS_LE_14,
        recurrence: regle({ count: 5 }),
      });

      expect(
        debuts(
          occurrences(
            cinqFois,
            [],
            periode('2026-09-17T00:00:00.000Z', '2026-09-30T00:00:00.000Z'),
          ),
        ),
      ).toEqual(['2026-09-17T07:00:00.000Z', '2026-09-18T07:00:00.000Z']);
    });

    it('compte dans `count` une occurrence supprimée, sans la remplacer', () => {
      const troisFois = evenement({
        startsAt: DEPUIS_LE_14,
        recurrence: regle({ count: 3 }),
      });

      expect(
        debuts(
          occurrences(
            troisFois,
            [annulee('2026-09-15T07:00:00.000Z')],
            SEPTEMBRE,
          ),
        ),
      ).toEqual(['2026-09-14T07:00:00.000Z', '2026-09-16T07:00:00.000Z']);
    });

    it("n'a pas de fin sans `until` ni `count` : la période seule la borne", () => {
      const sansFin = evenement({
        startsAt: '2020-01-06T08:00:00.000Z',
        recurrence: regle({ freq: 'WEEKLY' }),
      });

      expect(
        debuts(
          occurrences(
            sansFin,
            [],
            periode('2036-01-07T00:00:00.000Z', '2036-01-14T00:00:00.000Z'),
          ),
        ),
      ).toEqual(['2036-01-07T08:00:00.000Z']);
    });
  });

  describe('Les bornes de la période', () => {
    const CHAQUE_JOUR_DE_9_A_10 = evenement({
      startsAt: '2026-09-14T07:00:00.000Z',
      endsAt: '2026-09-14T08:00:00.000Z',
      recurrence: regle({}),
    });

    it('inclut une occurrence qui commence exactement à la fin de la période', () => {
      expect(
        debuts(
          occurrences(
            CHAQUE_JOUR_DE_9_A_10,
            [],
            periode('2026-09-15T08:30:00.000Z', '2026-09-16T07:00:00.000Z'),
          ),
        ),
      ).toEqual(['2026-09-16T07:00:00.000Z']);
    });

    it('inclut une occurrence qui finit exactement au début de la période', () => {
      expect(
        debuts(
          occurrences(
            CHAQUE_JOUR_DE_9_A_10,
            [],
            periode('2026-09-15T08:00:00.000Z', '2026-09-16T06:59:59.999Z'),
          ),
        ),
      ).toEqual(['2026-09-15T07:00:00.000Z']);
    });

    it('inclut une occurrence commencée avant la période et qui la rencontre', () => {
      const vacancesChaqueAnnee = evenement({
        startsAt: '2026-07-25T22:00:00.000Z', // 26 juillet, minuit
        endsAt: '2026-08-08T22:00:00.000Z', // 9 août, minuit
        recurrence: regle({ freq: 'YEARLY' }),
      });

      expect(
        occurrences(
          vacancesChaqueAnnee,
          [],
          periode('2027-07-31T22:00:00.000Z', '2027-08-31T21:59:59.999Z'),
        ).map(({ startsAt, endsAt }) => [
          startsAt.toISOString(),
          endsAt?.toISOString(),
        ]),
      ).toEqual([['2027-07-25T22:00:00.000Z', '2027-08-08T22:00:00.000Z']]);
    });

    it("n'a aucune occurrence avant le début de la série", () => {
      const aPartirDOctobre = evenement({
        startsAt: '2026-10-05T07:00:00.000Z',
        recurrence: regle({}),
      });

      expect(
        occurrences(
          aPartirDOctobre,
          [],
          periode('2026-09-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z'),
        ),
      ).toEqual([]);
    });
  });

  describe('Les exceptions', () => {
    const CHAQUE_JOUR_DE_9_A_10 = evenement({
      title: 'Point du matin',
      startsAt: '2026-09-14T07:00:00.000Z',
      endsAt: '2026-09-14T08:00:00.000Z',
      recurrence: regle({}),
    });
    const DU_15_AU_17 = periode(
      '2026-09-14T22:00:00.000Z',
      '2026-09-17T21:59:59.999Z',
    );

    it('retire une occurrence supprimée, et elle seule', () => {
      expect(
        debuts(
          occurrences(
            CHAQUE_JOUR_DE_9_A_10,
            [annulee('2026-09-16T07:00:00.000Z')],
            DU_15_AU_17,
          ),
        ),
      ).toEqual(['2026-09-15T07:00:00.000Z', '2026-09-17T07:00:00.000Z']);
    });

    it('renomme une occurrence sans toucher à ses bornes ni à son identité', () => {
      const [, renommee] = occurrences(
        CHAQUE_JOUR_DE_9_A_10,
        [modifiee('2026-09-16T07:00:00.000Z', { title: 'Point annulé ?' })],
        DU_15_AU_17,
      );

      expect(renommee).toEqual({
        originalStart: instant('2026-09-16T07:00:00.000Z'),
        startsAt: instant('2026-09-16T07:00:00.000Z'),
        endsAt: instant('2026-09-16T08:00:00.000Z'),
        title: 'Point annulé ?',
      });
    });

    it('déplace une occurrence en gardant sa durée, et la range à sa nouvelle place', () => {
      const rendues = occurrences(
        CHAQUE_JOUR_DE_9_A_10,
        [
          modifiee('2026-09-15T07:00:00.000Z', {
            startsAt: '2026-09-16T12:00:00.000Z',
          }),
        ],
        DU_15_AU_17,
      );

      expect(
        rendues.map(({ originalStart, startsAt, endsAt }) => [
          originalStart.toISOString(),
          startsAt.toISOString(),
          endsAt?.toISOString(),
        ]),
      ).toEqual([
        [
          '2026-09-16T07:00:00.000Z',
          '2026-09-16T07:00:00.000Z',
          '2026-09-16T08:00:00.000Z',
        ],
        [
          '2026-09-15T07:00:00.000Z',
          '2026-09-16T12:00:00.000Z',
          '2026-09-16T13:00:00.000Z',
        ],
        [
          '2026-09-17T07:00:00.000Z',
          '2026-09-17T07:00:00.000Z',
          '2026-09-17T08:00:00.000Z',
        ],
      ]);
    });

    it('prend la fin que l’exception donne', () => {
      const [allongee] = occurrences(
        CHAQUE_JOUR_DE_9_A_10,
        [
          modifiee('2026-09-15T07:00:00.000Z', {
            endsAt: '2026-09-15T10:00:00.000Z',
          }),
        ],
        DU_15_AU_17,
      );

      expect(allongee.endsAt).toEqual(instant('2026-09-15T10:00:00.000Z'));
    });

    it('ne rend pas une occurrence déplacée hors de la période', () => {
      expect(
        debuts(
          occurrences(
            CHAQUE_JOUR_DE_9_A_10,
            [
              modifiee('2026-09-16T07:00:00.000Z', {
                startsAt: '2026-09-25T07:00:00.000Z',
              }),
            ],
            DU_15_AU_17,
          ),
        ),
      ).toEqual(['2026-09-15T07:00:00.000Z', '2026-09-17T07:00:00.000Z']);
    });

    it('rend une occurrence déplacée dans la période depuis l’extérieur', () => {
      const rendues = occurrences(
        CHAQUE_JOUR_DE_9_A_10,
        [
          modifiee('2026-09-25T07:00:00.000Z', {
            startsAt: '2026-09-16T15:00:00.000Z',
          }),
        ],
        DU_15_AU_17,
      );

      expect(
        rendues.map(({ originalStart, startsAt }) => [
          originalStart.toISOString(),
          startsAt.toISOString(),
        ]),
      ).toEqual([
        ['2026-09-15T07:00:00.000Z', '2026-09-15T07:00:00.000Z'],
        ['2026-09-16T07:00:00.000Z', '2026-09-16T07:00:00.000Z'],
        ['2026-09-25T07:00:00.000Z', '2026-09-16T15:00:00.000Z'],
        ['2026-09-17T07:00:00.000Z', '2026-09-17T07:00:00.000Z'],
      ]);
    });

    it('rend une occurrence avancée avant le début de la série', () => {
      const rendues = occurrences(
        evenement({
          startsAt: '2026-10-05T07:00:00.000Z',
          recurrence: regle({ freq: 'WEEKLY' }),
        }),
        [
          modifiee('2026-10-05T07:00:00.000Z', {
            startsAt: '2026-09-30T07:00:00.000Z',
          }),
        ],
        periode('2026-09-01T00:00:00.000Z', '2026-09-30T21:59:59.999Z'),
      );

      expect(debuts(rendues)).toEqual(['2026-09-30T07:00:00.000Z']);
    });

    it("s'applique aussi à un Événement qui n'a lieu qu'une fois", () => {
      const unique = evenement({ startsAt: '2026-09-16T07:00:00.000Z' });

      expect(
        occurrences(unique, [annulee('2026-09-16T07:00:00.000Z')], DU_15_AU_17),
      ).toEqual([]);
    });
  });

  describe('Le changement de règle', () => {
    const LUNDI_9H = '2026-09-14T07:00:00.000Z';
    const SEPTEMBRE = periode(
      '2026-08-31T22:00:00.000Z',
      '2026-09-30T21:59:59.999Z',
    );

    it('se reflète aussitôt : les occurrences suivent la nouvelle règle', () => {
      const avant = evenement({
        startsAt: LUNDI_9H,
        recurrence: regle({ freq: 'WEEKLY' }),
      });
      const apres = {
        ...avant,
        recurrence: regle({ freq: 'WEEKLY', interval: 2 }),
      };

      expect(debuts(occurrences(avant, [], SEPTEMBRE))).toEqual([
        '2026-09-14T07:00:00.000Z',
        '2026-09-21T07:00:00.000Z',
        '2026-09-28T07:00:00.000Z',
      ]);
      expect(debuts(occurrences(apres, [], SEPTEMBRE))).toEqual([
        '2026-09-14T07:00:00.000Z',
        '2026-09-28T07:00:00.000Z',
      ]);
    });

    it("ignore l'exception d'une occurrence que la règle ne produit plus", () => {
      // Le 21 était supprimé, le 22 déplacé dans la période ; la série passe
      // de 9 h à 10 h. Ni l'une ni l'autre n'a plus d'occurrence à viser.
      const reculee = evenement({
        startsAt: '2026-09-14T08:00:00.000Z',
        recurrence: regle({ freq: 'WEEKLY' }),
      });

      expect(
        debuts(
          occurrences(
            reculee,
            [
              annulee('2026-09-21T07:00:00.000Z'),
              modifiee('2026-10-05T07:00:00.000Z', {
                startsAt: '2026-09-29T07:00:00.000Z',
              }),
            ],
            SEPTEMBRE,
          ),
        ),
      ).toEqual([
        '2026-09-14T08:00:00.000Z',
        '2026-09-21T08:00:00.000Z',
        '2026-09-28T08:00:00.000Z',
      ]);
    });

    it("ignore l'exception d'une occurrence au-delà du nouveau `count`", () => {
      const raccourcie = evenement({
        startsAt: LUNDI_9H,
        recurrence: regle({ freq: 'WEEKLY', count: 2 }),
      });

      expect(
        debuts(
          occurrences(
            raccourcie,
            [
              modifiee('2026-09-28T07:00:00.000Z', {
                startsAt: '2026-09-15T07:00:00.000Z',
              }),
            ],
            SEPTEMBRE,
          ),
        ),
      ).toEqual(['2026-09-14T07:00:00.000Z', '2026-09-21T07:00:00.000Z']);
    });
  });
});
