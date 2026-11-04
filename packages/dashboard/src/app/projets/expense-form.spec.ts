import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, type Router } from '@angular/router';
import { aujourdhui } from '@personal-os/contracts';
import { filter, firstValueFrom } from 'rxjs';
import { BASE, ouvrirLesProjets, RELIURE } from '../../testing/projets';

function champ(el: HTMLElement, nom: string): HTMLInputElement {
  return el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
}

function saisir(element: HTMLInputElement, valeur: string): void {
  element.value = valeur;
  element.dispatchEvent(new Event('input'));
}

function envoyer(el: HTMLElement): void {
  (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
}

function arrivee(router: Router): Promise<unknown> {
  return firstValueFrom(
    router.events.pipe(
      filter((evenement) => evenement instanceof NavigationEnd),
    ),
  );
}

async function ouvrir(url: string) {
  const ouvert = await ouvrirLesProjets(url);
  ouvert.http.expectOne(`${BASE}/projects/projet-1`).flush(RELIURE);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

describe('Le formulaire d’une dépense', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('se préremplit par son URL, au jour d’aujourd’hui sinon, sans rien enregistrer', async () => {
    const { el, http } = await ouvrir(
      '/projets/projet-1/depenses/nouvelle?label=Papier%20japonais',
    );

    expect(champ(el(), 'libelle').value).toBe('Papier japonais');
    expect(champ(el(), 'montant').value).toBe('');
    expect(champ(el(), 'jour').value).toBe(aujourdhui());
    expect(el().textContent).toContain('Atelier de reliure');
    http.expectNone(() => true);
  });

  it('ajoute la dépense en centimes exacts, puis revient à la fiche', async () => {
    const { http, el, router } = await ouvrir(
      '/projets/projet-1/depenses/nouvelle?spentOn=2026-10-12',
    );

    saisir(champ(el(), 'libelle'), 'Papier japonais');
    // 4,35 € en euros flottants donnerait 434 centimes.
    saisir(champ(el(), 'montant'), '4,35');
    envoyer(el());

    const envoi = http.expectOne(`${BASE}/projects/projet-1/expenses`);
    expect(envoi.request.method).toBe('POST');
    expect(envoi.request.body).toEqual({
      label: 'Papier japonais',
      amount: { cents: 435, currency: 'EUR' },
      spentOn: '2026-10-12',
    });
    const navigation = arrivee(router);
    envoi.flush({
      id: 'depense-3',
      projectId: 'projet-1',
      label: 'Papier japonais',
      amount: { cents: 435, currency: 'EUR' },
      spentOn: '2026-10-12',
      createdAt: '2026-10-12T09:00:00.000Z',
    });
    await navigation;

    expect(router.url).toBe('/projets/projet-1');
    // La fiche ouverte relit le Projet.
    TestBed.tick();
    http.expectOne(`${BASE}/projects/projet-1`);
  });

  it('refuse un montant illisible sans rien envoyer', async () => {
    const { harness, http, el } = await ouvrir(
      '/projets/projet-1/depenses/nouvelle',
    );

    saisir(champ(el(), 'libelle'), 'Papier japonais');
    saisir(champ(el(), 'montant'), '4,355');
    envoyer(el());
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Un montant en euros, au centime près');
    http.expectNone(`${BASE}/projects/projet-1/expenses`);
  });

  it('montre sous chaque champ le refus de l’API', async () => {
    const { harness, http, el } = await ouvrir(
      '/projets/projet-1/depenses/nouvelle',
    );

    saisir(champ(el(), 'montant'), '2000000');
    envoyer(el());
    http.expectOne(`${BASE}/projects/projet-1/expenses`).flush(
      {
        status: 400,
        code: 'request.invalid',
        message: 'La requête est invalide.',
        fields: [
          {
            path: 'label',
            code: 'too_small',
            message: 'Le libellé est obligatoire.',
          },
          {
            path: 'amount.cents',
            code: 'too_big',
            message: 'Au plus un million d’euros.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();

    expect(el().textContent).toContain('Le libellé est obligatoire.');
    expect(el().textContent).toContain('Au plus un million d’euros.');
  });
});
