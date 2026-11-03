import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ShoppingList } from '@personal-os/contracts';
import { BEURRE } from '../../testing/catalogue';
import {
  BASE,
  EPONGES,
  FARINE,
  LAIT,
  LISTE,
  LISTE_PRECEDENTE,
  ouvrirLesCourses,
} from '../../testing/courses';

type Ouvert = Awaited<ReturnType<typeof ouvrirLesCourses>>;

const OUVERTES = `${BASE}/shopping-lists?status=OPEN`;

/** `/courses`, devant ces listes ouvertes. */
async function ouvrir(
  listes: ShoppingList[] = [LISTE],
  options?: Parameters<typeof ouvrirLesCourses>[1],
): Promise<Ouvert> {
  const ouvert = await ouvrirLesCourses('/courses', options);
  ouvert.http.expectOne(OUVERTES).flush(listes);
  await ouvert.harness.fixture.whenStable();
  return ouvert;
}

function articles(el: HTMLElement, groupe: 'planning' | 'ajouts') {
  return [
    ...el.querySelectorAll(
      `[data-test="groupe-${groupe}"] [data-test="article-de-liste"]`,
    ),
  ] as HTMLElement[];
}

function article(el: HTMLElement, id: string): HTMLElement {
  return el.querySelector(`[data-id="${id}"]`) as HTMLElement;
}

/** Le texte d'un élément, ses espaces insécables rendus ordinaires. */
function texte(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function titre(ligne: HTMLElement): string | undefined {
  return ligne
    .querySelector('[data-slot="list-row-title"]')
    ?.textContent?.trim();
}

function caseDe(el: HTMLElement, id: string): HTMLButtonElement {
  return article(el, id).querySelector(
    '[role="checkbox"]',
  ) as HTMLButtonElement;
}

function champ(el: HTMLElement, nom: string): HTMLInputElement {
  return el.querySelector(`[data-test="${nom}"]`) as HTMLInputElement;
}

/** Saisit une valeur ; la recherche qu'elle lance reste en attente de sa réponse. */
function saisir(
  ouvert: Ouvert,
  nom: 'article' | 'quantite',
  valeur: string,
): void {
  const input = champ(ouvert.el(), nom);
  input.value = valeur;
  input.dispatchEvent(new Event('input'));
  TestBed.tick();
}

function envoyer(ouvert: Ouvert): void {
  ouvert
    .el()
    .querySelector('[data-test="ajout"]')
    ?.dispatchEvent(new Event('submit', { cancelable: true }));
  TestBed.tick();
}

/** Laisse la confirmation répondre, puis la requête partir. */
async function apresLaConfirmation(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

describe('La Liste de courses', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('montre la plus récente des listes ouvertes, les articles du planning puis les ajouts manuels', async () => {
    const { el } = await ouvrir([LISTE, LISTE_PRECEDENTE]);

    const entete = el().querySelector('dccm-page-header') as HTMLElement;
    expect(entete.querySelector('h1')?.textContent).toContain(
      'Liste de courses',
    );
    expect(texte(entete)).toContain('Semaine du 2 novembre · figée le');
    expect(articles(el(), 'planning').map(titre)).toEqual([
      'Farine de blé',
      'Lait demi-écrémé',
    ]);
    expect(articles(el(), 'ajouts').map(titre)).toEqual(['Éponges']);
    expect(texte(article(el(), FARINE.id))).toContain('550 g');
    expect(texte(article(el(), LAIT.id))).toContain('1 000 ml');
    expect(texte(article(el(), EPONGES.id))).toContain('× 2');
    expect(caseDe(el(), LAIT.id).getAttribute('aria-checked')).toBe('true');
    expect(caseDe(el(), FARINE.id).getAttribute('aria-checked')).toBe('false');
    expect(
      el().querySelector('[data-test="achetes"]')?.textContent?.trim(),
    ).toBe('1 / 3 achetés');
  });

  it('mène aux autres listes ouvertes, et ouvre une liste par son lien', async () => {
    const ouvert = await ouvrir([LISTE, LISTE_PRECEDENTE]);
    const lien = ouvert
      .el()
      .querySelector('[data-test="autre-liste"]') as HTMLAnchorElement;
    expect(lien.textContent?.trim()).toBe('Semaine du 26 octobre');
    expect(lien.getAttribute('href')).toBe('/courses/liste-0');
  });

  it('sur `/courses/:id`, montre la liste demandée', async () => {
    const ouvert = await ouvrirLesCourses(`/courses/${LISTE_PRECEDENTE.id}`);
    ouvert.http.expectOne(OUVERTES).flush([LISTE, LISTE_PRECEDENTE]);
    ouvert.http
      .expectOne(`${BASE}/shopping-lists/${LISTE_PRECEDENTE.id}`)
      .flush({ ...LISTE_PRECEDENTE, items: [EPONGES] });
    await ouvert.harness.fixture.whenStable();

    expect(
      texte(ouvert.el().querySelector('dccm-page-header') as HTMLElement),
    ).toContain('Semaine du 26 octobre');
    expect(articles(ouvert.el(), 'ajouts').map(titre)).toEqual(['Éponges']);
    expect(
      ouvert.el().querySelector('[data-test="autre-liste"]')?.textContent,
    ).toContain('Semaine du 2 novembre');
  });

  it('coche un article en un geste, sans bouton', async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    caseDe(el(), FARINE.id).click();
    TestBed.tick();

    expect(caseDe(el(), FARINE.id).getAttribute('aria-checked')).toBe('true');
    const cochage = http.expectOne(
      `${BASE}/shopping-lists/${LISTE.id}/items/${FARINE.id}/check`,
    );
    expect(cochage.request.method).toBe('POST');
    cochage.flush({ ...FARINE, checked: true });
    await ouvert.harness.fixture.whenStable();

    expect(
      el().querySelector('[data-test="achetes"]')?.textContent?.trim(),
    ).toBe('2 / 3 achetés');
  });

  it('décoche un article coché', async () => {
    const ouvert = await ouvrir();

    caseDe(ouvert.el(), LAIT.id).click();
    TestBed.tick();

    ouvert.http
      .expectOne(`${BASE}/shopping-lists/${LISTE.id}/items/${LAIT.id}/uncheck`)
      .flush({ ...LAIT, checked: false });
    await ouvert.harness.fixture.whenStable();
    expect(caseDe(ouvert.el(), LAIT.id).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it("n'envoie qu'un cochage à la fois par article, et le dernier geste gagne", async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    caseDe(el(), FARINE.id).click();
    TestBed.tick();
    caseDe(el(), FARINE.id).click();
    TestBed.tick();

    http
      .expectOne(`${BASE}/shopping-lists/${LISTE.id}/items/${FARINE.id}/check`)
      .flush({ ...FARINE, checked: true });
    await ouvert.harness.fixture.whenStable();

    http
      .expectOne(
        `${BASE}/shopping-lists/${LISTE.id}/items/${FARINE.id}/uncheck`,
      )
      .flush({ ...FARINE, checked: false });
    await ouvert.harness.fixture.whenStable();
    expect(caseDe(el(), FARINE.id).getAttribute('aria-checked')).toBe('false');
  });

  it("dit le refus d'un cochage, et relit la liste", async () => {
    const ouvert = await ouvrir();
    const { el, http } = ouvert;

    caseDe(el(), FARINE.id).click();
    TestBed.tick();
    http
      .expectOne(`${BASE}/shopping-lists/${LISTE.id}/items/${FARINE.id}/check`)
      .flush(
        {
          status: 422,
          code: 'food.list_already_closed',
          message:
            'Cette Liste de courses est close : elle ne se modifie plus.',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    TestBed.tick();

    expect(el().querySelector('[data-test="refus"]')?.textContent).toContain(
      'Cette Liste de courses est close',
    );
    http.expectOne(OUVERTES).flush([LISTE]);
    await ouvert.harness.fixture.whenStable();
    expect(caseDe(el(), FARINE.id).getAttribute('aria-checked')).toBe('false');
  });

  describe("l'ajout manuel", () => {
    it('ajoute un simple libellé, avec sa quantité, en tête des gestes', async () => {
      const ouvert = await ouvrir();
      const { el, http } = ouvert;
      // Le formulaire d'ajout passe avant les articles.
      const ajout = el().querySelector('[data-test="ajout"]') as HTMLElement;
      const premier = el().querySelector('[data-test="groupe-planning"]');
      expect(
        ajout.compareDocumentPosition(premier as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      saisir(ouvert, 'article', 'Sacs poubelle');
      http.expectOne(`${BASE}/ingredients?q=Sacs%20poubelle`).flush([]);
      saisir(ouvert, 'quantite', '1');
      envoyer(ouvert);

      const envoi = http.expectOne(`${BASE}/shopping-lists/${LISTE.id}/items`);
      expect(envoi.request.method).toBe('POST');
      expect(envoi.request.body).toEqual({
        label: 'Sacs poubelle',
        quantity: 1,
      });
      envoi.flush({
        ...EPONGES,
        id: 'article-sacs',
        label: 'Sacs poubelle',
        quantity: 1,
        position: 3,
      });
      await ouvert.harness.fixture.whenStable();

      expect(articles(el(), 'ajouts').map(titre)).toEqual([
        'Éponges',
        'Sacs poubelle',
      ]);
      expect(champ(el(), 'article').value).toBe('');
      expect(champ(el(), 'quantite').value).toBe('');
    });

    it('propose les Ingrédients du catalogue, et en ajoute un dans son Unité canonique', async () => {
      const ouvert = await ouvrir();
      const { el, http } = ouvert;

      saisir(ouvert, 'article', 'beu');
      http.expectOne(`${BASE}/ingredients?q=beu`).flush([BEURRE]);
      await ouvert.harness.fixture.whenStable();
      const suggestion = el().querySelector(
        '[data-test="suggestion"]',
      ) as HTMLButtonElement;
      expect(suggestion.textContent).toContain('Beurre doux');
      suggestion.click();
      await ouvert.harness.fixture.whenStable();

      expect(champ(el(), 'article').value).toBe('Beurre doux');
      expect(el().querySelector('[data-test="unite"]')?.textContent).toBe('g');
      expect(el().querySelector('[data-test="suggestion"]')).toBeNull();

      saisir(ouvert, 'quantite', '250');
      envoyer(ouvert);
      const envoi = http.expectOne(`${BASE}/shopping-lists/${LISTE.id}/items`);
      expect(envoi.request.body).toEqual({
        ingredientId: BEURRE.id,
        quantity: 250,
      });
      envoi.flush({
        ...FARINE,
        id: 'article-beurre',
        ingredient: {
          id: BEURRE.id,
          displayName: 'Beurre doux',
          canonicalUnit: 'GRAM',
          perishable: false,
        },
        quantity: 250,
        origin: 'MANUAL',
        position: 3,
      });
      await ouvert.harness.fixture.whenStable();

      expect(texte(article(el(), 'article-beurre'))).toContain('250 g');
    });

    it('se préremplit depuis le lien, sans rien enregistrer', async () => {
      const ouvert = await ouvrirLesCourses(
        '/courses?label=Sacs%20poubelle&quantity=2',
      );
      ouvert.http.expectOne(OUVERTES).flush([LISTE]);
      TestBed.tick();
      ouvert.http.expectOne(`${BASE}/ingredients?q=Sacs%20poubelle`).flush([]);
      await ouvert.harness.fixture.whenStable();

      expect(champ(ouvert.el(), 'article').value).toBe('Sacs poubelle');
      expect(champ(ouvert.el(), 'quantite').value).toBe('2');
      expect(ouvert.el().querySelector('[data-test="ignores"]')).toBeNull();
      // Aucun POST : le contrôle des requêtes ouvertes le vérifie.
    });

    it('préremplit un Ingrédient du catalogue par son identifiant', async () => {
      const ouvert = await ouvrirLesCourses(
        `/courses?ingredientId=${BEURRE.id}&quantity=250`,
      );
      ouvert.http.expectOne(OUVERTES).flush([LISTE]);
      ouvert.http.expectOne(`${BASE}/ingredients/${BEURRE.id}`).flush(BEURRE);
      await ouvert.harness.fixture.whenStable();

      expect(champ(ouvert.el(), 'article').value).toBe('Beurre doux');
      expect(
        texte(ouvert.el().querySelector('[data-test="choisi"]')),
      ).toContain('Beurre doux');
      expect(
        ouvert.el().querySelector('[data-test="unite"]')?.textContent,
      ).toBe('g');
      expect(champ(ouvert.el(), 'quantite').value).toBe('250');
    });

    it("garde la saisie quand l'Ingrédient du lien arrive après elle", async () => {
      const ouvert = await ouvrirLesCourses(
        `/courses?ingredientId=${BEURRE.id}`,
      );
      ouvert.http.expectOne(OUVERTES).flush([LISTE]);
      const lecture = ouvert.http.expectOne(`${BASE}/ingredients/${BEURRE.id}`);
      // La liste se rend, la lecture de l'Ingrédient toujours en attente.
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();

      saisir(ouvert, 'article', 'Éponges');
      ouvert.http.expectOne(`${BASE}/ingredients?q=%C3%89ponges`).flush([]);
      // La réponse tardive, si la lecture n'a pas été abandonnée.
      if (!lecture.cancelled) lecture.flush(BEURRE);
      await ouvert.harness.fixture.whenStable();

      expect(champ(ouvert.el(), 'article').value).toBe('Éponges');
      expect(ouvert.el().querySelector('[data-test="choisi"]')).toBeNull();
      envoyer(ouvert);
      const envoi = ouvert.http.expectOne(
        `${BASE}/shopping-lists/${LISTE.id}/items`,
      );
      expect(envoi.request.body).toEqual({ label: 'Éponges' });
      envoi.flush({ ...EPONGES, id: 'article-nouveau', quantity: null });
      await ouvert.harness.fixture.whenStable();
    });

    it("dit l'échec de lecture de l'Ingrédient du lien, sans l'écarter, et relit", async () => {
      const ouvert = await ouvrirLesCourses(
        `/courses?ingredientId=${BEURRE.id}`,
      );
      ouvert.http.expectOne(OUVERTES).flush([LISTE]);
      ouvert.http.expectOne(`${BASE}/ingredients/${BEURRE.id}`).flush(
        {
          status: 503,
          code: 'unavailable',
          message: 'La base ne répond pas.',
        },
        { status: 503, statusText: 'Service Unavailable' },
      );
      await ouvert.harness.fixture.whenStable();

      expect(ouvert.el().querySelector('[data-test="ignores"]')).toBeNull();
      const echec = ouvert
        .el()
        .querySelector('[data-test="lecture-du-lien"]') as HTMLElement;
      expect(texte(echec)).toContain('La base ne répond pas.');

      (echec.querySelector('button') as HTMLButtonElement).click();
      TestBed.tick();
      ouvert.http.expectOne(`${BASE}/ingredients/${BEURRE.id}`).flush(BEURRE);
      await ouvert.harness.fixture.whenStable();

      expect(
        ouvert.el().querySelector('[data-test="lecture-du-lien"]'),
      ).toBeNull();
      expect(champ(ouvert.el(), 'article').value).toBe('Beurre doux');
    });

    it('signale les valeurs du lien écartées, sans les appliquer', async () => {
      const ouvert = await ouvrirLesCourses(
        '/courses?quantity=-3&ingredientId=inconnu',
      );
      ouvert.http.expectOne(OUVERTES).flush([LISTE]);
      ouvert.http.expectOne(`${BASE}/ingredients/inconnu`).flush(
        {
          status: 404,
          code: 'food.ingredient_not_found',
          message: "Cet Ingrédient n'existe pas.",
        },
        { status: 404, statusText: 'Not Found' },
      );
      await ouvert.harness.fixture.whenStable();

      const ignores = texte(ouvert.el().querySelector('[data-test="ignores"]'));
      expect(ignores).toContain('quantity=-3');
      expect(ignores).toContain('ingredientId=inconnu');
      expect(champ(ouvert.el(), 'article').value).toBe('');
      expect(champ(ouvert.el(), 'quantite').value).toBe('');
      expect(ouvert.el().querySelector('[data-test="choisi"]')).toBeNull();
    });

    it('revient au simple libellé quand on retouche le texte', async () => {
      const ouvert = await ouvrir();
      const { el, http } = ouvert;

      saisir(ouvert, 'article', 'beu');
      http.expectOne(`${BASE}/ingredients?q=beu`).flush([BEURRE]);
      await ouvert.harness.fixture.whenStable();
      (
        el().querySelector('[data-test="suggestion"]') as HTMLButtonElement
      ).click();
      await ouvert.harness.fixture.whenStable();
      (
        el().querySelector('[data-test="oublier"]') as HTMLButtonElement
      ).click();
      TestBed.tick();
      http.expectOne(`${BASE}/ingredients?q=Beurre%20doux`).flush([]);
      envoyer(ouvert);

      expect(
        http.expectOne(`${BASE}/shopping-lists/${LISTE.id}/items`).request.body,
      ).toEqual({ label: 'Beurre doux' });
    });

    it('montre le refus sous le champ en cause', async () => {
      const ouvert = await ouvrir();
      const { el, http } = ouvert;

      saisir(ouvert, 'article', 'x');
      saisir(ouvert, 'quantite', '0.0001');
      envoyer(ouvert);
      http.expectOne(`${BASE}/shopping-lists/${LISTE.id}/items`).flush(
        {
          status: 400,
          code: 'request.invalid',
          message: 'La requête ne respecte pas son schéma.',
          fields: [
            {
              path: 'quantity',
              code: 'custom',
              message: 'La quantité se donne au millième près.',
            },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await ouvert.harness.fixture.whenStable();

      expect(el().querySelector('[data-test="ajout"]')?.textContent).toContain(
        'La quantité se donne au millième près.',
      );
      expect(champ(el(), 'article').value).toBe('x');
    });

    it('montre un refus métier en bandeau', async () => {
      const ouvert = await ouvrir();
      const { el, http } = ouvert;

      saisir(ouvert, 'article', 'x');
      envoyer(ouvert);
      http.expectOne(`${BASE}/shopping-lists/${LISTE.id}/items`).flush(
        {
          status: 422,
          code: 'food.list_already_closed',
          message:
            'Cette Liste de courses est close : elle ne se modifie plus.',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await ouvert.harness.fixture.whenStable();

      expect(
        el().querySelector('[data-test="refus-ajout"]')?.textContent,
      ).toContain('Cette Liste de courses est close');
    });
  });

  describe('le retrait', () => {
    it('ne se propose que sur un ajout manuel', async () => {
      const { el } = await ouvrir();

      expect(
        article(el(), FARINE.id).querySelector('[data-test="retirer"]'),
      ).toBeNull();
      expect(
        article(el(), EPONGES.id)
          .querySelector('[data-test="retirer"]')
          ?.getAttribute('aria-label'),
      ).toBe('Retirer Éponges de la liste');
    });

    it('retire un ajout manuel après confirmation', async () => {
      const ouvert = await ouvrir();
      const { el, http, confirmations } = ouvert;

      (
        article(el(), EPONGES.id).querySelector(
          '[data-test="retirer"]',
        ) as HTMLButtonElement
      ).click();
      await apresLaConfirmation();

      expect(confirmations).toEqual([
        expect.objectContaining({ destructive: true }),
      ]);
      const retrait = http.expectOne(
        `${BASE}/shopping-lists/${LISTE.id}/items/${EPONGES.id}`,
      );
      expect(retrait.request.method).toBe('DELETE');
      retrait.flush(null, { status: 204, statusText: 'No Content' });
      await ouvert.harness.fixture.whenStable();

      expect(articles(el(), 'ajouts')).toEqual([]);
    });

    it("ne retire rien si l'on renonce", async () => {
      const ouvert = await ouvrirLesCourses('/courses', { confirme: false });
      ouvert.http.expectOne(OUVERTES).flush([LISTE]);
      await ouvert.harness.fixture.whenStable();

      (
        article(ouvert.el(), EPONGES.id).querySelector(
          '[data-test="retirer"]',
        ) as HTMLButtonElement
      ).click();
      await apresLaConfirmation();

      expect(articles(ouvert.el(), 'ajouts').map(titre)).toEqual(['Éponges']);
    });
  });

  describe('la clôture', () => {
    const CLOTURE = `${BASE}/shopping-lists/${LISTE.id}/close`;

    function recap(el: HTMLElement): HTMLElement | null {
      return el.querySelector('[data-test="recapitulatif"]');
    }

    function ligneDuRecap(el: HTMLElement, id: string): HTMLElement {
      return recap(el)?.querySelector(`[data-recap="${id}"]`) as HTMLElement;
    }

    function remplir(input: HTMLInputElement, valeur: string): void {
      input.value = valeur;
      input.dispatchEvent(new Event('input'));
      TestBed.tick();
    }

    function bouton(el: HTMLElement, nom: string): HTMLButtonElement {
      return el.querySelector(`[data-test="${nom}"]`) as HTMLButtonElement;
    }

    async function ouvrirLeRecap(ouvert: Ouvert): Promise<void> {
      bouton(ouvert.el(), 'cloturer').click();
      await ouvert.harness.fixture.whenStable();
    }

    it("récapitule les articles cochés, et envoie l'achat confirmé", async () => {
      const ouvert = await ouvrir([
        { ...LISTE, items: [FARINE, LAIT, { ...EPONGES, checked: true }] },
      ]);
      const { el, http, confirmations } = ouvert;
      expect(recap(el())).toBeNull();
      expect(texte(bouton(el(), 'cloturer'))).toContain('2/3 achetés');

      await ouvrirLeRecap(ouvert);

      // Seuls les articles cochés : le lait, et les éponges hors stock.
      expect(ligneDuRecap(el(), FARINE.id)).toBeNull();
      const lait = ligneDuRecap(el(), LAIT.id);
      const quantite = lait.querySelector(
        '[data-test="quantite-achetee"]',
      ) as HTMLInputElement;
      expect(quantite.value).toBe('1000');
      expect(texte(lait)).toContain('ml');
      expect(texte(ligneDuRecap(el(), EPONGES.id))).toContain('hors stock');
      expect(ligneDuRecap(el(), EPONGES.id).querySelector('input')).toBeNull();

      remplir(quantite, '1500');
      remplir(
        lait.querySelector('[data-test="peremption"]') as HTMLInputElement,
        '2026-11-10',
      );
      bouton(el(), 'confirmer-cloture').click();
      await apresLaConfirmation();

      expect(confirmations).toEqual([
        expect.objectContaining({
          title: 'Clôturer la liste de courses ?',
          confirmLabel: 'Confirmer la clôture',
        }),
      ]);
      const envoi = http.expectOne(CLOTURE);
      expect(envoi.request.method).toBe('POST');
      expect(envoi.request.body).toEqual({
        items: [
          { itemId: LAIT.id, purchasedQuantity: 1500, expiresOn: '2026-11-10' },
        ],
      });
      envoi.flush({
        ...LISTE,
        status: 'CLOSED',
        closedAt: '2026-11-03T10:00:00.000Z',
      });
      await ouvert.harness.fixture.whenStable();

      expect(recap(el())).toBeNull();
      expect(el().querySelector('[data-test="cloturer"]')).toBeNull();
      expect(el().querySelector('[role="checkbox"]')).toBeNull();
      expect(el().querySelector('[data-test="close"]')?.textContent).toContain(
        'Close',
      );
    });

    it("ne demande pas de péremption pour un Ingrédient qui ne périt pas, et laisse le serveur prendre la quantité de la liste si on l'efface", async () => {
      const ouvert = await ouvrir([
        { ...LISTE, items: [{ ...FARINE, checked: true }] },
      ]);
      await ouvrirLeRecap(ouvert);

      const farine = ligneDuRecap(ouvert.el(), FARINE.id);
      expect(farine.querySelector('[data-test="peremption"]')).toBeNull();
      remplir(
        farine.querySelector(
          '[data-test="quantite-achetee"]',
        ) as HTMLInputElement,
        '',
      );
      bouton(ouvert.el(), 'confirmer-cloture').click();
      await apresLaConfirmation();

      const envoi = ouvert.http.expectOne(CLOTURE);
      expect(envoi.request.body).toEqual({ items: [{ itemId: FARINE.id }] });
      envoi.flush({ ...LISTE, status: 'CLOSED', closedAt: LISTE.producedAt });
      await ouvert.harness.fixture.whenStable();
    });

    it('attend la fin des cochages en route avant de clôturer, et fige les cases pendant l’envoi', async () => {
      const ouvert = await ouvrir([{ ...LISTE, items: [FARINE] }]);
      const { el, http } = ouvert;
      const COCHAGE = `${BASE}/shopping-lists/${LISTE.id}/items/${FARINE.id}`;

      // Cochée puis décochée avant la réponse du premier cochage.
      caseDe(el(), FARINE.id).click();
      TestBed.tick();
      caseDe(el(), FARINE.id).click();
      TestBed.tick();
      const premier = http.expectOne(`${COCHAGE}/check`);
      await ouvrirLeRecap(ouvert);
      bouton(el(), 'confirmer-cloture').click();
      await apresLaConfirmation();

      // La clôture attend : le serveur voit encore la farine cochée.
      http.expectNone(CLOTURE);
      expect(caseDe(el(), FARINE.id).disabled).toBe(true);
      premier.flush({ ...FARINE, checked: true });
      await apresLaConfirmation();
      http.expectNone(CLOTURE);

      http.expectOne(`${COCHAGE}/uncheck`).flush({ ...FARINE, checked: false });
      await apresLaConfirmation();
      const envoi = http.expectOne(CLOTURE);
      expect(envoi.request.body).toEqual({ items: [] });
      envoi.flush({ ...LISTE, items: [FARINE], status: 'CLOSED' });
      await ouvert.harness.fixture.whenStable();
    });

    it('ne clôture pas si un cochage en route est refusé, et dit le refus', async () => {
      const ouvert = await ouvrir([{ ...LISTE, items: [FARINE] }]);
      const { el, http } = ouvert;

      caseDe(el(), FARINE.id).click();
      TestBed.tick();
      const cochage = http.expectOne(
        `${BASE}/shopping-lists/${LISTE.id}/items/${FARINE.id}/check`,
      );
      await ouvrirLeRecap(ouvert);
      bouton(el(), 'confirmer-cloture').click();
      await apresLaConfirmation();

      cochage.flush(
        {
          status: 422,
          code: 'food.list_already_closed',
          message:
            'Cette Liste de courses est close : elle ne se modifie plus.',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await apresLaConfirmation();

      http.expectNone(CLOTURE);
      expect(texte(el().querySelector('[data-test="refus"]'))).toContain(
        'Cette Liste de courses est close',
      );
      http.expectOne(OUVERTES).flush([{ ...LISTE, items: [FARINE] }]);
      await ouvert.harness.fixture.whenStable();
      expect(caseDe(el(), FARINE.id).disabled).toBe(false);
    });

    it("ne clôt rien si l'on renonce, et le récapitulatif reste ouvert", async () => {
      const ouvert = await ouvrir([LISTE], { confirme: false });
      await ouvrirLeRecap(ouvert);

      bouton(ouvert.el(), 'confirmer-cloture').click();
      await apresLaConfirmation();

      expect(recap(ouvert.el())).not.toBeNull();
      // Aucun POST : le contrôle des requêtes ouvertes le vérifie.
    });

    it('se referme sans rien envoyer', async () => {
      const ouvert = await ouvrir();
      await ouvrirLeRecap(ouvert);

      bouton(ouvert.el(), 'annuler-cloture').click();
      await ouvert.harness.fixture.whenStable();

      expect(recap(ouvert.el())).toBeNull();
      expect(bouton(ouvert.el(), 'cloturer')).not.toBeNull();
    });

    it("dit le refus de l'API, et l'erreur sous l'article en cause", async () => {
      const ouvert = await ouvrir();
      const { el, http } = ouvert;
      await ouvrirLeRecap(ouvert);

      bouton(el(), 'confirmer-cloture').click();
      await apresLaConfirmation();
      http.expectOne(CLOTURE).flush(
        {
          status: 422,
          code: 'food.expiry_required',
          message:
            "La liste n'est pas close : un article périssable n’a pas de date de péremption.",
          fields: [
            {
              path: LAIT.id,
              code: 'expiry_required',
              message:
                '« Lait demi-écrémé » périt : sa péremption est requise.',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      await ouvert.harness.fixture.whenStable();

      expect(
        texte(el().querySelector('[data-test="refus-cloture"]')),
      ).toContain("La liste n'est pas close");
      expect(texte(ligneDuRecap(el(), LAIT.id))).toContain(
        'sa péremption est requise',
      );
      // Seul le champ en cause passe en erreur.
      const lait = ligneDuRecap(el(), LAIT.id);
      expect(
        lait
          .querySelector('[data-test="peremption"]')
          ?.getAttribute('aria-invalid'),
      ).toBe('true');
      expect(
        lait
          .querySelector('[data-test="quantite-achetee"]')
          ?.getAttribute('aria-invalid'),
      ).not.toBe('true');
      expect(bouton(el(), 'cloturer')).toBeNull();
    });

    it("dit quand aucun article n'est coché", async () => {
      const ouvert = await ouvrir([{ ...LISTE, items: [FARINE] }]);
      await ouvrirLeRecap(ouvert);

      expect(texte(recap(ouvert.el()))).toContain('Aucun article coché');
    });

    it("s'ouvre depuis le lien, sans rien enregistrer", async () => {
      const ouvert = await ouvrirLesCourses(`/courses/${LISTE.id}?cloture=1`);
      ouvert.http.expectOne(OUVERTES).flush([LISTE]);
      ouvert.http.expectOne(`${BASE}/shopping-lists/${LISTE.id}`).flush(LISTE);
      await ouvert.harness.fixture.whenStable();

      expect(ligneDuRecap(ouvert.el(), LAIT.id)).not.toBeNull();
    });

    it('ne se propose pas sur une liste close', async () => {
      const ouvert = await ouvrirLesCourses(`/courses/${LISTE.id}?cloture=1`);
      ouvert.http.expectOne(OUVERTES).flush([]);
      ouvert.http.expectOne(`${BASE}/shopping-lists/${LISTE.id}`).flush({
        ...LISTE,
        status: 'CLOSED',
        closedAt: '2026-11-03T10:00:00.000Z',
      });
      await ouvert.harness.fixture.whenStable();

      expect(recap(ouvert.el())).toBeNull();
      expect(ouvert.el().querySelector('[data-test="cloturer"]')).toBeNull();
    });
  });

  it('montre une liste close sans rien à cocher ni à ajouter, et ce qui a été acheté', async () => {
    const ouvert = await ouvrirLesCourses(`/courses/${LISTE.id}`);
    ouvert.http.expectOne(OUVERTES).flush([]);
    ouvert.http.expectOne(`${BASE}/shopping-lists/${LISTE.id}`).flush({
      ...LISTE,
      status: 'CLOSED',
      closedAt: '2026-11-03T10:00:00.000Z',
    });
    await ouvert.harness.fixture.whenStable();

    expect(articles(ouvert.el(), 'planning')).toHaveLength(2);
    expect(ouvert.el().querySelector('[role="checkbox"]')).toBeNull();
    expect(ouvert.el().querySelector('[data-test="ajout"]')).toBeNull();
    expect(ouvert.el().querySelector('[data-test="retirer"]')).toBeNull();
    const entete = ouvert.el().querySelector('dccm-page-header') as HTMLElement;
    expect(entete.querySelector('[data-test="close"]')?.textContent).toContain(
      'Close',
    );
    expect(texte(entete)).toContain('close le 3 novembre');
    expect(texte(article(ouvert.el(), LAIT.id))).toContain('1 000 ml · acheté');
    expect(texte(article(ouvert.el(), FARINE.id))).not.toContain('acheté');
  });

  it('sans liste ouverte, renvoie au planning de repas', async () => {
    const { el } = await ouvrir([]);

    expect(el().textContent).toContain('Aucune liste de courses ouverte');
    expect(
      el().querySelector('a[href="/repas/planning"]')?.textContent,
    ).toContain('Aller au planning de repas');
  });

  it('dit un échec de lecture, et relit', async () => {
    const ouvert = await ouvrirLesCourses('/courses');
    ouvert.http
      .expectOne(OUVERTES)
      .flush(
        { status: 503, code: 'unavailable', message: 'La base ne répond pas.' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await ouvert.harness.fixture.whenStable();

    expect(ouvert.el().textContent).toContain('La base ne répond pas.');
    const relire = [...ouvert.el().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Réessayer'),
    ) as HTMLButtonElement;
    relire.click();
    TestBed.tick();
    ouvert.http.expectOne(OUVERTES).flush([LISTE]);
    await ouvert.harness.fixture.whenStable();
    expect(articles(ouvert.el(), 'planning')).toHaveLength(2);
  });
});
