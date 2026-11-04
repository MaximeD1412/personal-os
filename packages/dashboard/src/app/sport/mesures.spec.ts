import {
  allure,
  ecartDAllure,
  ecartDeDistance,
  ecartDeDuree,
  formaterDistance,
  formaterDuree,
  lireDistance,
  lireDuree,
  saisieDeDistance,
  saisieDeDuree,
} from './mesures';

describe('Les mesures d’une Séance', () => {
  describe('à l’affichage', () => {
    it.each([
      [10_000, '10 km'],
      [11_200, '11,2 km'],
      [12_250, '12,25 km'],
      [800, '800 m'],
    ])('écrit %i m en « %s »', (metres, texte) => {
      expect(formaterDistance(metres)).toBe(texte);
    });

    it.each([
      [3_600, '1 h 00'],
      [3_840, '1 h 04'],
      [2_700, '45 min'],
      [3_492, '58 min 12 s'],
    ])('écrit %i s en « %s »', (secondes, texte) => {
      expect(formaterDuree(secondes)).toBe(texte);
    });
  });

  describe('l’allure, calculée à l’affichage', () => {
    it('se lit en minutes par kilomètre pour la course', () => {
      expect(allure('RUN', 11_200, 3_840)).toBe('5:43 /km');
    });

    it('en minutes par 100 m pour la natation', () => {
      expect(allure('SWIM', 1_500, 1_800)).toBe('2:00 /100 m');
    });

    it('en kilomètres par heure pour le vélo', () => {
      expect(allure('BIKE', 32_000, 4_500)).toBe('25,6 km/h');
    });

    it('n’existe pas sans distance ni durée, ni pour le renforcement', () => {
      expect(allure('RUN', null, 3_600)).toBeNull();
      expect(allure('RUN', 10_000, null)).toBeNull();
      expect(allure('STRENGTH', 1_000, 600)).toBeNull();
    });
  });

  describe('l’écart entre le prévu et le réalisé', () => {
    it('se signe, champ par champ', () => {
      expect(ecartDeDistance(10_000, 11_200)).toBe('+1,2 km');
      expect(ecartDeDistance(12_000, 11_800)).toBe('−200 m');
      expect(ecartDeDuree(3_600, 3_840)).toBe('+4 min');
      expect(ecartDeDuree(3_600, 3_492)).toBe('−1 min 48 s');
    });

    it('est nul quand le réalisé tient le prévu', () => {
      expect(ecartDeDistance(10_000, 10_000)).toBe('=');
    });

    it('n’existe pas sans l’une des deux valeurs', () => {
      expect(ecartDeDistance(null, 10_000)).toBeNull();
      expect(ecartDeDuree(3_600, null)).toBeNull();
    });

    it('se compte en secondes par kilomètre pour une allure de course', () => {
      // Prévu 6:00 /km, réalisé 5:43 /km : plus rapide de 17 s.
      expect(
        ecartDAllure(
          'RUN',
          { distanceM: 10_000, dureeS: 3_600 },
          {
            distanceM: 11_200,
            dureeS: 3_840,
          },
        ),
      ).toBe('−17 s');
    });
  });

  describe('à la saisie', () => {
    it.each([
      ['10', 10_000],
      ['10,5', 10_500],
      ['12.25', 12_250],
      [' 0,8 ', 800],
    ])('lit « %s » km', (texte, metres) => {
      expect(lireDistance(texte)).toBe(metres);
    });

    it.each([
      ['45', 2_700],
      ['45:30', 2_730],
      ['1:04:30', 3_870],
    ])('lit la durée « %s »', (texte, secondes) => {
      expect(lireDuree(texte)).toBe(secondes);
    });

    it.each(['', 'dix', '-3', '1:75'])('refuse « %s »', (texte) => {
      expect(lireDistance(texte)).toBeNull();
      expect(lireDuree(texte)).toBeNull();
    });

    it('réécrit une valeur du contrat dans le champ qui la saisit', () => {
      expect(saisieDeDistance(10_500)).toBe('10,5');
      expect(saisieDeDuree(3_870)).toBe('1:04:30');
      expect(saisieDeDuree(2_700)).toBe('45');
      expect(saisieDeDuree(2_730)).toBe('45:30');
    });
  });
});
