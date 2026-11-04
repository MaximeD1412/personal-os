import type { TrainingSession } from '@personal-os/contracts';
import { vueDeSeance } from './vue-de-seance';

const SEANCE: TrainingSession = {
  id: 'seance-1',
  startsAt: '2026-10-20T05:15:00.000Z',
  sport: 'RUN',
  status: 'DONE',
  plannedDistanceM: 10_000,
  plannedDurationS: 3_600,
  plannedIntent: 'Footing',
  actualDistanceM: 11_200,
  actualDurationS: 3_840,
  actualNotes: 'Bonnes sensations',
  goalId: null,
  scopeId: 'espace-a',
  createdAt: '2026-10-19T08:00:00.000Z',
};

describe('vueDeSeance', () => {
  it('compare le réalisé au prévu champ par champ', () => {
    expect(vueDeSeance(SEANCE).comparaisons).toEqual([
      {
        libelle: 'Distance',
        realise: '11,2 km',
        prevu: '10 km',
        ecart: '+1,2 km',
      },
      { libelle: 'Durée', realise: '1 h 04', prevu: '1 h 00', ecart: '+4 min' },
      {
        libelle: 'Allure',
        realise: '5:43 /km',
        prevu: '6:00 /km',
        ecart: '−17 s',
      },
    ]);
  });

  it('montre le prévu seul d’une Séance manquée', () => {
    const vue = vueDeSeance({
      ...SEANCE,
      status: 'MISSED',
      plannedDurationS: null,
      actualDistanceM: null,
      actualDurationS: null,
      actualNotes: null,
    });

    expect(vue.statut).toEqual({ libelle: 'Manquée', tone: 'error' });
    expect(vue.comparaisons).toEqual([
      { libelle: 'Distance', realise: null, prevu: '10 km', ecart: null },
    ]);
  });

  it('reconnaît une sortie non planifiée', () => {
    const sortie = {
      ...SEANCE,
      plannedDistanceM: null,
      plannedDurationS: null,
      plannedIntent: null,
    };

    expect(vueDeSeance(sortie).nonPlanifiee).toBe(true);
    expect(vueDeSeance(SEANCE).nonPlanifiee).toBe(false);
    expect(vueDeSeance(sortie).titre).toBe('Course à pied');
  });
});
