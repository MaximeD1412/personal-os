import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { TrainingSession } from '@personal-os/contracts';
import { DccmConfirm } from '@personal-os/ui/dccm';
import { API_BASE_URL } from '../api-base-url';
import { INTERCEPTEURS } from '../app.config';
import { Seance } from './seance';
import { MANQUEE, PREVUE, REALISEE } from './seances-de-test';

const BASE = 'http://api.test/api';

@Component({ template: '' })
class Ecran {}

describe('Seance', () => {
  let httpMock: HttpTestingController;
  let confirmation: { confirm: jest.Mock };

  beforeEach(async () => {
    confirmation = { confirm: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'sport', component: Ecran },
          { path: 'sport/seances/:id', component: Seance },
        ]),
        provideHttpClient(withInterceptors(INTERCEPTEURS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: DccmConfirm, useValue: confirmation },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const lecture = (id: string): TestRequest =>
    httpMock.expectOne(
      ({ method, url }) =>
        method === 'GET' && url === `${BASE}/training-sessions/${id}`,
    );

  async function ouvrir(seance: TrainingSession) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/sport/seances/${seance.id}`);
    lecture(seance.id).flush(seance);
    await stabiliser(harness);
    return { harness, racine: harness.routeNativeElement as HTMLElement };
  }

  async function stabiliser(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** La relecture qui suit une écriture réussie. */
  async function relire(
    harness: RouterTestingHarness,
    seance: TrainingSession,
  ): Promise<void> {
    await new Promise((fin) => setTimeout(fin));
    TestBed.tick();
    lecture(seance.id).flush(seance);
    await stabiliser(harness);
  }

  const champ = (racine: HTMLElement, nom: string) =>
    racine.querySelector(`[data-test="${nom}"]`) as HTMLInputElement | null;

  function saisir(racine: HTMLElement, nom: string, valeur: string): void {
    const cible = champ(racine, nom) as HTMLInputElement;
    cible.value = valeur;
    cible.dispatchEvent(new Event('input'));
  }

  async function envoyer(
    harness: RouterTestingHarness,
    formulaire: 'declaration' | 'modification',
  ): Promise<void> {
    (
      (harness.routeNativeElement as HTMLElement).querySelector(
        `[data-test="${formulaire}"] button[type="submit"]`,
      ) as HTMLButtonElement
    ).click();
    await stabiliser(harness);
  }

  const ecriture = (methode: string, chemin = ''): TestRequest =>
    httpMock.expectOne(
      ({ method, url }) =>
        method === methode && url === `${BASE}/training-sessions/${chemin}`,
    );

  it('lit le prévu et le réalisé côte à côte, avec leur écart', async () => {
    const { racine } = await ouvrir(REALISEE);
    const lignes = [...racine.querySelectorAll('[data-test="mesure"]')].map(
      (ligne) =>
        [...ligne.querySelectorAll('td')].map((cellule) =>
          cellule.textContent?.trim(),
        ),
    );

    expect(lignes).toEqual([
      ['Distance', '10 km', '11,2 km', '+1,2 km'],
      ['Durée', '1 h 00', '1 h 04', '+4 min'],
      ['Allure', '6:00 /km', '5:43 /km', '−17 s'],
    ]);
    expect(champ(racine, 'statut')?.textContent?.trim()).toBe('Réalisée');
  });

  describe('Une Séance prévue', () => {
    it('se marque réalisée avec ce qui a été fait, puis se relit', async () => {
      const { harness, racine } = await ouvrir(PREVUE);
      saisir(racine, 'actual-distance', '11,2');
      saisir(racine, 'actual-duree', '1:04:00');
      await envoyer(harness, 'declaration');

      const requete = ecriture('POST', `${PREVUE.id}/complete`);
      expect(requete.request.body).toEqual({
        actualDistanceM: 11_200,
        actualDurationS: 3_840,
      });
      requete.flush({ ...REALISEE, id: PREVUE.id });
      await relire(harness, { ...REALISEE, id: PREVUE.id });

      expect(champ(racine, 'statut')?.textContent?.trim()).toBe('Réalisée');
      expect(champ(racine, 'declaration')).toBeNull();
    });

    it('se marque manquée après confirmation, sans rien saisir', async () => {
      const { harness, racine } = await ouvrir(PREVUE);
      (champ(racine, 'marquer-manquee') as HTMLElement).click();
      await stabiliser(harness);

      expect(confirmation.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ confirmLabel: 'Marquer manquée' }),
      );
      const requete = ecriture('POST', `${PREVUE.id}/miss`);
      expect(requete.request.body).toEqual({});
      requete.flush({ ...PREVUE, status: 'MISSED' });
      await relire(harness, { ...PREVUE, status: 'MISSED' });

      expect(champ(racine, 'statut')?.textContent?.trim()).toBe('Manquée');
      expect(champ(racine, 'marquer-manquee')).toBeNull();
    });

    it('ne change rien quand la confirmation est refusée', async () => {
      confirmation.confirm.mockResolvedValue(null);
      const { harness, racine } = await ouvrir(PREVUE);
      (champ(racine, 'marquer-manquee') as HTMLElement).click();
      await stabiliser(harness);

      httpMock.expectNone(`${BASE}/training-sessions/${PREVUE.id}/miss`);
    });

    it('affiche le refus de la transition, tel que l’API le formule', async () => {
      const { harness, racine } = await ouvrir(PREVUE);
      (champ(racine, 'marquer-manquee') as HTMLElement).click();
      await stabiliser(harness);

      ecriture('POST', `${PREVUE.id}/miss`).flush(
        {
          status: 422,
          code: 'training.already_done',
          message: 'Cette Séance est déjà réalisée.',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await stabiliser(harness);

      expect(champ(racine, 'refus')?.textContent).toContain(
        'Cette Séance est déjà réalisée.',
      );
    });

    it('ne modifie que son prévu', async () => {
      const { racine } = await ouvrir(PREVUE);

      expect(champ(racine, 'planned-distance')?.value).toBe('10');
      // Le seul réalisé à l'écran est celui de « Marquer réalisée ».
      expect(
        racine.querySelector(
          '[data-test="modification"] [data-test="actual-distance"]',
        ),
      ).toBeNull();
    });
  });

  describe('La modification', () => {
    it('n’envoie que ce qui change, et retire un champ vidé', async () => {
      const { harness, racine } = await ouvrir(REALISEE);
      saisir(racine, 'planned-distance', '12');
      saisir(racine, 'planned-texte', '');
      saisir(racine, 'actual-texte', 'Vent de face');
      await envoyer(harness, 'modification');

      const requete = ecriture('PATCH', REALISEE.id);
      expect(requete.request.body).toEqual({
        plannedDistanceM: 12_000,
        plannedIntent: null,
        actualNotes: 'Vent de face',
      });
      requete.flush(REALISEE);
      await relire(harness, REALISEE);
    });

    it('n’envoie rien quand rien ne change', async () => {
      const { harness } = await ouvrir(MANQUEE);
      await envoyer(harness, 'modification');

      httpMock.expectNone(`${BASE}/training-sessions/${MANQUEE.id}`);
    });

    it('n’offre aucune transition à une Séance manquée', async () => {
      const { racine } = await ouvrir(MANQUEE);

      expect(champ(racine, 'marquer-manquee')).toBeNull();
      expect(champ(racine, 'declaration')).toBeNull();
      expect(champ(racine, 'planned-distance')?.value).toBe('1,5');
    });
  });
});
