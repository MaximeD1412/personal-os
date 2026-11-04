import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Recipe } from '@personal-os/contracts';
import { choisirDansLeSelect } from '../../testing/hlm-select';
import { arrivee } from '../../testing/planning';
import { BEURRE, OIGNON } from '../../testing/catalogue';
import { BASE, DAHL, ouvrirLesRecettes } from '../../testing/recettes';

type Ouvert = Awaited<ReturnType<typeof ouvrirLesRecettes>>;

const NOUVELLE = '/repas/recettes/nouvelle';

const GRATIN: Recipe = {
  ...DAHL,
  id: 'recette-9',
  title: 'Gratin',
  servings: 4,
  steps: ['Cuire 40 minutes.'],
  lines: [
    {
      id: 'ligne-9',
      ingredient: { id: 'ingredient-1', displayName: 'Lentilles corail' },
      quantity: 200,
      unit: 'G',
    },
  ],
};

function lignes(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('[data-test="ligne"]')];
}

function champ(racine: ParentNode, nom: string): HTMLInputElement {
  return racine.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
}

function saisir(champ: HTMLInputElement | HTMLTextAreaElement, valeur: string) {
  champ.value = valeur;
  champ.dispatchEvent(new Event('input'));
}

async function remplirLaLigne(
  ouvert: Ouvert,
  rang: number,
  {
    quantite,
    unite,
    libelle,
  }: { quantite: string; unite: string; libelle: string },
): Promise<void> {
  const ligne = lignes(ouvert.el())[rang];
  saisir(champ(ligne, 'quantite'), quantite);
  saisir(champ(ligne, 'libelle'), libelle);
  await choisirDansLeSelect(ouvert.harness.fixture, `unite-${rang}`, unite);
}

function soumettre(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).requestSubmit();
  TestBed.tick();
}

describe('La saisie d’une Recette', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('résout tous les libellés en un appel, puis crée la recette et ouvre sa fiche', async () => {
    const ouvert = await ouvrirLesRecettes(
      `${NOUVELLE}?title=Gratin&servings=4`,
    );
    const { el, http, harness, router } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '200',
      unite: 'Gramme (g)',
      libelle: 'lentilles',
    });
    saisir(champ(el(), 'etape'), 'Cuire 40 minutes.');
    soumettre(el());

    const resolution = http.expectOne(`${BASE}/ingredients/resolve`);
    expect(resolution.request.method).toBe('POST');
    expect(resolution.request.body).toEqual({ labels: ['lentilles'] });
    resolution.flush([{ label: 'lentilles', ingredientId: 'ingredient-1' }]);

    const creation = http.expectOne(`${BASE}/recipes`);
    expect(creation.request.method).toBe('POST');
    expect(creation.request.body).toEqual({
      title: 'Gratin',
      servings: 4,
      steps: ['Cuire 40 minutes.'],
      lines: [{ ingredientId: 'ingredient-1', quantity: 200, unit: 'G' }],
    });
    const ouverte = arrivee(router);
    creation.flush(GRATIN);
    await ouverte;

    expect(router.url).toBe('/repas/recettes/recette-9');
    // La fiche ouverte lit la recette.
    TestBed.tick();
    http.expectOne(`${BASE}/recipes/recette-9`).flush(GRATIN);
  });

  it('n’enregistre pas une recette dont un libellé est inconnu : il montre ses suggestions et la création', async () => {
    const ouvert = await ouvrirLesRecettes(
      `${NOUVELLE}?title=Gratin&servings=4`,
    );
    const { el, http, harness } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '2',
      unite: 'Pièce',
      libelle: 'Oignons',
    });
    soumettre(el());
    http
      .expectOne(`${BASE}/ingredients/resolve`)
      .flush([
        { label: 'Oignons', unknown: true, suggestions: ['ingredient-2'] },
      ]);
    TestBed.tick();
    // Les suggestions se nomment par le catalogue.
    http
      .expectOne((requete) => requete.url === `${BASE}/ingredients`)
      .flush([OIGNON]);
    await harness.fixture.whenStable();

    const inconnu = champ(el(), 'inconnu');
    expect(inconnu.textContent).toContain(
      "«\u00a0Oignons\u00a0» n'est pas au catalogue",
    );
    expect(
      [...inconnu.querySelectorAll('[data-test="suggestion"]')].map((bouton) =>
        bouton.textContent?.trim(),
      ),
    ).toEqual(['Oignon jaune']);
    expect(champ(inconnu, 'creer-ingredient')).not.toBeNull();
    expect(
      el().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
    ).toBe(true);
    expect(champ(el(), 'a-rattacher').textContent).toContain(
      'Rattachez chaque libellé inconnu',
    );

    // Même envoyé, le formulaire ne crée rien.
    soumettre(el());
    http.expectNone(`${BASE}/recipes`);
    http.expectNone(`${BASE}/ingredients/resolve`);
  });

  it('rattache un libellé inconnu à une suggestion en créant l’Alias, puis enregistre', async () => {
    const ouvert = await ouvrirLesRecettes(
      `${NOUVELLE}?title=Gratin&servings=4`,
    );
    const { el, http, harness, router } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '2',
      unite: 'Pièce',
      libelle: 'Oignons',
    });
    (champ(el(), 'ajouter-ligne') as unknown as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    await remplirLaLigne(ouvert, 1, {
      quantite: '1',
      unite: 'Pièce',
      libelle: 'oignons',
    });
    soumettre(el());
    const resolution = http.expectOne(`${BASE}/ingredients/resolve`);
    expect(resolution.request.body).toEqual({ labels: ['Oignons', 'oignons'] });
    resolution.flush([
      { label: 'Oignons', unknown: true, suggestions: ['ingredient-2'] },
      { label: 'oignons', unknown: true, suggestions: ['ingredient-2'] },
    ]);
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/ingredients`)
      .flush([OIGNON]);
    await harness.fixture.whenStable();

    (
      champ(lignes(el())[0], 'suggestion') as unknown as HTMLButtonElement
    ).click();
    const alias = http.expectOne(`${BASE}/ingredient-aliases`);
    expect(alias.request.method).toBe('POST');
    expect(alias.request.body).toEqual({
      label: 'Oignons',
      ingredientId: 'ingredient-2',
    });
    alias.flush({
      id: 'alias-1',
      label: 'Oignons',
      ingredientId: 'ingredient-2',
      createdAt: '2026-11-04T08:00:00.000Z',
    });
    await harness.fixture.whenStable();

    // L'Alias vaut pour les deux lignes : plus rien à rattacher.
    expect(el().querySelector('[data-test="inconnu"]')).toBeNull();
    expect(
      lignes(el()).map((ligne) => champ(ligne, 'reconnu')?.textContent?.trim()),
    ).toEqual(['Oignon jaune', 'Oignon jaune']);

    soumettre(el());
    const creation = http.expectOne(`${BASE}/recipes`);
    expect(creation.request.body.lines).toEqual([
      { ingredientId: 'ingredient-2', quantity: 2, unit: 'PIECE' },
      { ingredientId: 'ingredient-2', quantity: 1, unit: 'PIECE' },
    ]);
    const ouverte = arrivee(router);
    creation.flush(GRATIN);
    await ouverte;
    TestBed.tick();
    http.expectOne(`${BASE}/recipes/recette-9`).flush(GRATIN);
  });

  it('montre sur la ligne le refus d’un rattachement', async () => {
    const ouvert = await ouvrirLesRecettes(NOUVELLE);
    const { el, http, harness } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '2',
      unite: 'Pièce',
      libelle: 'Oignons',
    });
    soumettre(el());
    http
      .expectOne(`${BASE}/ingredients/resolve`)
      .flush([
        { label: 'Oignons', unknown: true, suggestions: ['ingredient-2'] },
      ]);
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/ingredients`)
      .flush([OIGNON]);
    await harness.fixture.whenStable();

    (champ(el(), 'suggestion') as unknown as HTMLButtonElement).click();
    http.expectOne(`${BASE}/ingredient-aliases`).flush(
      {
        status: 422,
        code: 'food.alias_conflict',
        message: 'Ce libellé désigne déjà un autre Ingrédient.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await harness.fixture.whenStable();

    expect(champ(el(), 'refus-rattachement').textContent).toContain(
      'Ce libellé désigne déjà un autre Ingrédient.',
    );
    expect(champ(el(), 'inconnu')).not.toBeNull();
  });

  it('ne rattache pas une ligne dont le libellé a changé pendant la résolution : il le résout de nouveau', async () => {
    const ouvert = await ouvrirLesRecettes(`${NOUVELLE}?title=Gâteau`);
    const { el, http, harness } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '200',
      unite: 'Gramme (g)',
      libelle: 'farine',
    });
    soumettre(el());
    const premiere = http.expectOne(`${BASE}/ingredients/resolve`);
    expect(premiere.request.body).toEqual({ labels: ['farine'] });

    // La réponse tarde : le libellé change entre-temps.
    saisir(champ(lignes(el())[0], 'libelle'), 'cacahuètes');
    premiere.flush([{ label: 'farine', ingredientId: 'ingredient-1' }]);

    http.expectNone(`${BASE}/recipes`);
    const seconde = http.expectOne(`${BASE}/ingredients/resolve`);
    expect(seconde.request.body).toEqual({ labels: ['cacahuètes'] });
    seconde.flush([{ label: 'cacahuètes', unknown: true, suggestions: [] }]);
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/ingredients`)
      .flush([]);
    await harness.fixture.whenStable();

    expect(champ(el(), 'inconnu').textContent).toContain('cacahuètes');
    expect(champ(el(), 'reconnu')).toBeNull();
    http.expectNone(`${BASE}/recipes`);
  });

  it('montre sous sa ligne le libellé que le résolveur refuse', async () => {
    const ouvert = await ouvrirLesRecettes(`${NOUVELLE}?title=Gratin`);
    const { el, http, harness } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '200',
      unite: 'Gramme (g)',
      libelle: 'lentilles',
    });
    (champ(el(), 'ajouter-ligne') as unknown as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    await remplirLaLigne(ouvert, 1, {
      quantite: '1',
      unite: 'Pièce',
      libelle: '?!',
    });
    soumettre(el());
    http.expectOne(`${BASE}/ingredients/resolve`).flush(
      {
        status: 400,
        code: 'validation.invalid_body',
        message: 'La saisie est invalide.',
        fields: [
          {
            path: 'labels.1',
            code: 'custom',
            message: 'Le nom doit contenir au moins une lettre.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();

    const [premiere, seconde] = lignes(el());
    expect(premiere.textContent).not.toContain('au moins une lettre');
    expect(seconde.textContent).toContain(
      'Le nom doit contenir au moins une lettre.',
    );
    http.expectNone(`${BASE}/recipes`);
  });

  it('garde une suggestion inactive tant que le catalogue ne la nomme pas, et propose de le relire', async () => {
    const ouvert = await ouvrirLesRecettes(NOUVELLE);
    const { el, http, harness } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '2',
      unite: 'Pièce',
      libelle: 'Oignons',
    });
    soumettre(el());
    http
      .expectOne(`${BASE}/ingredients/resolve`)
      .flush([
        { label: 'Oignons', unknown: true, suggestions: ['ingredient-2'] },
      ]);
    TestBed.tick();
    http.expectOne((requete) => requete.url === `${BASE}/ingredients`).flush(
      {
        status: 503,
        code: 'service_unavailable',
        message: 'Le catalogue est momentanément indisponible.',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await harness.fixture.whenStable();

    const suggestion = (): HTMLButtonElement =>
      champ(el(), 'suggestion') as unknown as HTMLButtonElement;
    expect(suggestion().disabled).toBe(true);
    expect(champ(el(), 'inconnu').textContent).toContain(
      'Le catalogue est momentanément indisponible.',
    );

    (champ(el(), 'relire-catalogue') as unknown as HTMLButtonElement).click();
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/ingredients`)
      .flush([OIGNON]);
    await harness.fixture.whenStable();

    expect(suggestion().disabled).toBe(false);
    expect(suggestion().textContent?.trim()).toBe('Oignon jaune');
    expect(champ(el(), 'relire-catalogue')).toBeNull();
  });

  describe('« Créer l’ingrédient »', () => {
    /** Une recette dont le libellé « Poireau » est inconnu, sans suggestion. */
    async function avecUnPoireauInconnu(): Promise<Ouvert> {
      const ouvert = await ouvrirLesRecettes(`${NOUVELLE}?title=Gratin`);
      const { el, http, harness } = ouvert;
      await harness.fixture.whenStable();
      await remplirLaLigne(ouvert, 0, {
        quantite: '300',
        unite: 'Gramme (g)',
        libelle: 'Poireau',
      });
      saisir(champ(el(), 'etape'), 'Émincer.');
      soumettre(el());
      http
        .expectOne(`${BASE}/ingredients/resolve`)
        .flush([{ label: 'Poireau', unknown: true, suggestions: [] }]);
      TestBed.tick();
      http
        .expectOne((requete) => requete.url === `${BASE}/ingredients`)
        .flush([]);
      await harness.fixture.whenStable();
      return ouvert;
    }

    it('ouvre la création préremplie, puis revient à la recette avec l’Ingrédient créé', async () => {
      const ouvert = await avecUnPoireauInconnu();
      const { el, http, harness, router } = ouvert;

      let ouverte = arrivee(router);
      (champ(el(), 'creer-ingredient') as unknown as HTMLButtonElement).click();
      await ouverte;
      await harness.fixture.whenStable();
      expect(router.url.split('?')[0]).toBe('/repas/ingredients/nouveau');
      expect(champ(el(), 'libelle').value).toBe('Poireau');
      expect(el().querySelector('[data-test="ignores"]')).toBeNull();

      (el().querySelector('[data-unite="GRAM"]') as HTMLButtonElement).click();
      await harness.fixture.whenStable();
      soumettre(el());
      const creation = http.expectOne(`${BASE}/ingredients`);
      expect(creation.request.method).toBe('POST');
      ouverte = arrivee(router);
      creation.flush({ ...OIGNON, id: 'ingredient-9', displayName: 'Poireau' });
      await ouverte;
      TestBed.tick();
      // Le nom de l'Ingrédient créé se lit au catalogue.
      http
        .expectOne((requete) => requete.url === `${BASE}/ingredients`)
        .flush([{ ...OIGNON, id: 'ingredient-9', displayName: 'Poireau' }]);
      await harness.fixture.whenStable();

      // La saisie reprend où on l'a laissée, la ligne rattachée.
      expect(router.url).toBe(
        `${NOUVELLE}?brouillon=1&ingredient=ingredient-9`,
      );
      expect(champ(el(), 'titre').value).toBe('Gratin');
      expect(champ(el(), 'etape').value).toBe('Émincer.');
      expect(champ(lignes(el())[0], 'libelle').value).toBe('Poireau');
      expect(champ(lignes(el())[0], 'quantite').value).toBe('300');
      expect(el().querySelector('[data-test="inconnu"]')).toBeNull();
      expect(champ(el(), 'reconnu').textContent?.trim()).toBe('Poireau');

      soumettre(el());
      http.expectNone(`${BASE}/ingredients/resolve`);
      const recette = http.expectOne(`${BASE}/recipes`);
      expect(recette.request.body).toEqual({
        title: 'Gratin',
        servings: 2,
        steps: ['Émincer.'],
        lines: [{ ingredientId: 'ingredient-9', quantity: 300, unit: 'G' }],
      });
      ouverte = arrivee(router);
      recette.flush(GRATIN);
      await ouverte;
      TestBed.tick();
      http.expectOne(`${BASE}/recipes/recette-9`).flush(GRATIN);
    });

    it('revient à la saisie, le libellé toujours à rattacher, quand on annule la création', async () => {
      const ouvert = await avecUnPoireauInconnu();
      const { el, http, harness, router } = ouvert;

      let ouverte = arrivee(router);
      (champ(el(), 'creer-ingredient') as unknown as HTMLButtonElement).click();
      await ouverte;
      await harness.fixture.whenStable();

      ouverte = arrivee(router);
      (
        [...el().querySelectorAll('button')].find(
          (bouton) => bouton.textContent?.trim() === 'Annuler',
        ) as HTMLButtonElement
      ).click();
      await ouverte;
      TestBed.tick();
      http
        .expectOne((requete) => requete.url === `${BASE}/ingredients`)
        .flush([]);
      await harness.fixture.whenStable();

      expect(router.url).toBe(`${NOUVELLE}?brouillon=1`);
      expect(champ(el(), 'titre').value).toBe('Gratin');
      expect(champ(lignes(el())[0], 'libelle').value).toBe('Poireau');
      expect(champ(el(), 'inconnu')).not.toBeNull();
    });
  });

  it('se préremplit par son URL, sans rien enregistrer', async () => {
    const { el, http, harness } = await ouvrirLesRecettes(
      `${NOUVELLE}?title=Gratin&servings=4`,
    );
    await harness.fixture.whenStable();

    expect(champ(el(), 'titre').value).toBe('Gratin');
    expect(
      el()
        .querySelector('[data-test="portions"] [role="spinbutton"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('4');
    expect(lignes(el())).toHaveLength(1);
    expect(el().querySelector('[data-test="ignores"]')).toBeNull();
    http.expectNone(() => true);
  });

  it('signale une valeur du lien qu’il n’a pas pu reprendre', async () => {
    const { el, harness } = await ouvrirLesRecettes(
      `${NOUVELLE}?title=Gratin&servings=0`,
    );
    await harness.fixture.whenStable();

    expect(champ(el(), 'ignores').textContent).toContain('servings=0');
    expect(champ(el(), 'titre').value).toBe('Gratin');
  });

  it('montre sous la bonne ligne l’erreur de forme que l’API renvoie', async () => {
    const ouvert = await ouvrirLesRecettes(`${NOUVELLE}?title=Gratin`);
    const { el, http, harness } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '200',
      unite: 'Gramme (g)',
      libelle: 'lentilles',
    });
    (champ(el(), 'ajouter-ligne') as unknown as HTMLButtonElement).click();
    (champ(el(), 'ajouter-ligne') as unknown as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    // La deuxième ligne reste vide : elle n'est pas envoyée.
    saisir(champ(lignes(el())[2], 'libelle'), 'oignon');
    soumettre(el());
    http.expectOne(`${BASE}/ingredients/resolve`).flush([
      { label: 'lentilles', ingredientId: 'ingredient-1' },
      { label: 'oignon', ingredientId: 'ingredient-2' },
    ]);

    const creation = http.expectOne(`${BASE}/recipes`);
    expect(creation.request.body.lines).toEqual([
      { ingredientId: 'ingredient-1', quantity: 200, unit: 'G' },
      { ingredientId: 'ingredient-2', quantity: null, unit: null },
    ]);
    creation.flush(
      {
        status: 400,
        code: 'validation.invalid_body',
        message: 'La saisie est invalide.',
        fields: [
          {
            path: 'lines.1.quantity',
            code: 'invalid_type',
            message: 'La quantité est requise.',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/ingredients`)
      .flush([BEURRE, OIGNON]);
    await harness.fixture.whenStable();

    const [premiere, , troisieme] = lignes(el());
    expect(premiere.textContent).not.toContain('La quantité est requise.');
    expect(troisieme.textContent).toContain('La quantité est requise.');
  });

  it('n’envoie pas les étapes vides, et les garde dans l’ordre choisi', async () => {
    const ouvert = await ouvrirLesRecettes(`${NOUVELLE}?title=Gratin`);
    const { el, http, harness } = ouvert;
    await harness.fixture.whenStable();

    await remplirLaLigne(ouvert, 0, {
      quantite: '200',
      unite: 'Gramme (g)',
      libelle: 'lentilles',
    });
    saisir(champ(el(), 'etape'), 'Cuire.');
    const ajouter = champ(
      el(),
      'ajouter-etape',
    ) as unknown as HTMLButtonElement;
    ajouter.click();
    ajouter.click();
    await harness.fixture.whenStable();
    const etapes = () => [
      ...el().querySelectorAll<HTMLTextAreaElement>('[data-test="etape"]'),
    ];
    saisir(etapes()[2], 'Éplucher.');
    await harness.fixture.whenStable();
    // « Éplucher. » passe en tête.
    (
      el().querySelectorAll('[data-test="monter"]')[2] as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    (
      el().querySelectorAll('[data-test="monter"]')[1] as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    expect(etapes().map(({ value }) => value)).toEqual([
      'Éplucher.',
      'Cuire.',
      '',
    ]);

    soumettre(el());
    http
      .expectOne(`${BASE}/ingredients/resolve`)
      .flush([{ label: 'lentilles', ingredientId: 'ingredient-1' }]);
    const creation = http.expectOne(`${BASE}/recipes`);
    expect(creation.request.body.steps).toEqual(['Éplucher.', 'Cuire.']);
    creation.flush(
      { status: 422, code: 'food.x', message: 'Refusé.' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    TestBed.tick();
    http
      .expectOne((requete) => requete.url === `${BASE}/ingredients`)
      .flush([]);
  });

  describe('en modification', () => {
    const MODIFIER = '/repas/recettes/recette-1/modifier';

    it('part de la recette lue, et n’envoie au résolveur que les libellés changés', async () => {
      const ouvert = await ouvrirLesRecettes(MODIFIER);
      const { el, http, harness, router } = ouvert;
      TestBed.tick();
      http.expectOne(`${BASE}/recipes/recette-1`).flush(DAHL);
      await harness.fixture.whenStable();

      expect(champ(el(), 'titre').value).toBe('Dahl de lentilles corail');
      expect(
        lignes(el()).map((ligne) => champ(ligne, 'libelle').value),
      ).toEqual(['Lentilles corail', 'Oignon jaune', 'Huile d’olive']);
      expect(
        lignes(el()).map((ligne) =>
          champ(ligne, 'reconnu')?.textContent?.trim(),
        ),
      ).toEqual(['Lentilles corail', 'Oignon jaune', 'Huile d’olive']);
      expect(
        [
          ...el().querySelectorAll<HTMLTextAreaElement>('[data-test="etape"]'),
        ].map(({ value }) => value),
      ).toEqual(DAHL.steps);

      saisir(champ(lignes(el())[1], 'libelle'), 'Oignon rouge');
      await harness.fixture.whenStable();
      expect(champ(lignes(el())[1], 'reconnu')).toBeNull();
      soumettre(el());
      const resolution = http.expectOne(`${BASE}/ingredients/resolve`);
      expect(resolution.request.body).toEqual({ labels: ['Oignon rouge'] });
      resolution.flush([
        { label: 'Oignon rouge', ingredientId: 'ingredient-4' },
      ]);

      const modification = http.expectOne(`${BASE}/recipes/recette-1`);
      expect(modification.request.method).toBe('PATCH');
      expect(modification.request.body).toEqual({
        title: 'Dahl de lentilles corail',
        servings: 4,
        steps: DAHL.steps,
        lines: [
          { ingredientId: 'ingredient-1', quantity: 250, unit: 'G' },
          { ingredientId: 'ingredient-4', quantity: 1, unit: 'PIECE' },
          { ingredientId: 'ingredient-3', quantity: 1.5, unit: 'TBSP' },
        ],
      });
      const ouverte = arrivee(router);
      modification.flush(DAHL);
      await ouverte;
      expect(router.url).toBe('/repas/recettes/recette-1');
      TestBed.tick();
      http.expectOne(`${BASE}/recipes/recette-1`).flush(DAHL);
    });

    it('enregistre sans résolveur quand chaque ligne a son Ingrédient', async () => {
      const { el, http, harness } = await ouvrirLesRecettes(
        `${MODIFIER}?title=Dahl`,
      );
      TestBed.tick();
      http.expectOne(`${BASE}/recipes/recette-1`).flush(DAHL);
      await harness.fixture.whenStable();
      expect(champ(el(), 'titre').value).toBe('Dahl');

      soumettre(el());
      http.expectNone(`${BASE}/ingredients/resolve`);
      const modification = http.expectOne(`${BASE}/recipes/recette-1`);
      expect(modification.request.body.title).toBe('Dahl');
      modification.flush(
        { status: 422, code: 'food.x', message: 'Refusé.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await harness.fixture.whenStable();
      expect(champ(el(), 'refus').textContent).toContain('Refusé.');
    });

    it('affiche le message de l’API pour une recette introuvable', async () => {
      const { el, http, harness } = await ouvrirLesRecettes(MODIFIER);
      TestBed.tick();
      http.expectOne(`${BASE}/recipes/recette-1`).flush(
        {
          status: 404,
          code: 'food.recipe_not_found',
          message: 'Cette recette est introuvable.',
        },
        { status: 404, statusText: 'Not Found' },
      );
      await harness.fixture.whenStable();
      expect(el().textContent).toContain('Cette recette est introuvable.');
      expect(el().querySelector('form')).toBeNull();
    });
  });
});
