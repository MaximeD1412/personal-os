import { InteractivityChecker } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DccmFormPage, type DccmFormPagePresentation } from './form-page';

// jsdom ne calcule aucune mise en page : tout élément y paraît invisible, et
// le piège de focus du CDK n'y trouverait rien à focaliser (voir confirm.spec).
const atteignable = (element: HTMLElement) =>
  element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled;
const toujoursFocalisable: Partial<InteractivityChecker> = {
  isFocusable: atteignable,
  isTabbable: atteignable,
  isVisible: () => true,
  isDisabled: (element) => (element as HTMLButtonElement).disabled,
};

@Component({
  imports: [DccmFormPage],
  template: `
    <dccm-form-page
      heading="Nouvel événement"
      submitLabel="Créer l'événement"
      [presentation]="presentation()"
      [ignored]="ignores()"
      [error]="erreur()"
      [pending]="envoi()"
      (submitted)="envois = envois + 1"
      (cancelled)="annulations = annulations + 1"
    >
      <input data-test="titre" name="titre" />
    </dccm-form-page>
  `,
})
class Formulaire {
  readonly presentation = signal<DccmFormPagePresentation>('page');
  readonly ignores = signal<string[]>([]);
  readonly erreur = signal<{
    message: string;
    fields?: { path: string; message: string }[];
  } | null>(null);
  readonly envoi = signal(false);
  envois = 0;
  annulations = 0;
}

async function rendre() {
  const fixture = TestBed.createComponent(Formulaire);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const bouton = (libelle: string) =>
    [...el.querySelectorAll('button')].find(
      (b) =>
        b.textContent?.trim() === libelle ||
        b.getAttribute('aria-label') === libelle,
    ) as HTMLButtonElement;
  const bandeaux = () =>
    [...el.querySelectorAll<HTMLElement>('[data-slot="alert"]')];
  return { fixture, el, bouton, bandeaux };
}

describe('DccmFormPage', () => {
  it('affiche les paramètres du lien qui n’ont pas été repris', async () => {
    const { fixture, bandeaux } = await rendre();
    expect(bandeaux()).toEqual([]);

    fixture.componentInstance.ignores.set(['couleur=violet', 'lieu=']);
    await fixture.whenStable();

    expect(bandeaux()).toHaveLength(1);
    expect(bandeaux()[0].dataset['tone']).toBe('warning');
    expect(bandeaux()[0].textContent).toContain(
      "Certaines valeurs du lien n'ont pas été reprises : couleur=violet, lieu=",
    );
  });

  it("désactive l'envoi en cours et n'envoie qu'une fois", async () => {
    const { fixture, el, bouton } = await rendre();
    const formulaire = el.querySelector('form') as HTMLFormElement;

    formulaire.requestSubmit(bouton("Créer l'événement"));
    expect(fixture.componentInstance.envois).toBe(1);

    fixture.componentInstance.envoi.set(true);
    await fixture.whenStable();

    const envoyer = bouton("Créer l'événement");
    expect(envoyer.disabled).toBe(true);
    expect(envoyer.getAttribute('aria-busy')).toBe('true');
    formulaire.requestSubmit();
    expect(fixture.componentInstance.envois).toBe(1);
  });

  it("affiche un refus sans champ dans un bandeau d'erreur, le message de l'API tel quel", async () => {
    const { fixture, bandeaux } = await rendre();

    fixture.componentInstance.erreur.set({
      message: 'La liste de courses est déjà clôturée.',
    });
    await fixture.whenStable();
    expect(bandeaux()).toHaveLength(1);
    expect(bandeaux()[0].dataset['tone']).toBe('error');
    expect(bandeaux()[0].textContent).toContain(
      'La liste de courses est déjà clôturée.',
    );

    // Un refus qui vise des champs s'affiche sous eux, pas en bandeau.
    fixture.componentInstance.erreur.set({
      message: 'Requête invalide.',
      fields: [{ path: 'title', message: 'Saisir un titre.' }],
    });
    await fixture.whenStable();
    expect(bandeaux()).toEqual([]);
  });

  it('garde les mêmes actions en panneau et en feuille, avec un bouton de fermeture', async () => {
    const { fixture, el, bouton } = await rendre();
    expect(el.querySelector('h1')?.textContent).toContain('Nouvel événement');

    for (const presentation of ['panel', 'sheet'] as const) {
      fixture.componentInstance.presentation.set(presentation);
      await fixture.whenStable();

      const region = el.querySelector(
        presentation === 'panel' ? '[role="region"]' : '[role="dialog"]',
      ) as HTMLElement;
      const titre = document.getElementById(
        region.getAttribute('aria-labelledby') ?? '',
      );
      expect(titre?.textContent).toContain('Nouvel événement');
      expect(bouton("Créer l'événement")).toBeDefined();
      bouton('Fermer').click();
    }
    bouton('Annuler').click();
    expect(fixture.componentInstance.annulations).toBe(3);
  });

  describe('en feuille', () => {
    @Component({
      imports: [DccmFormPage],
      template: `
        <button data-test="declencheur" (click)="ouverte.set(true)">
          Nouvel événement
        </button>
        @if (ouverte()) {
          <dccm-form-page
            heading="Nouvel événement"
            submitLabel="Créer l'événement"
            [presentation]="presentation()"
            (cancelled)="ouverte.set(false)"
          >
            <input data-test="titre" name="titre" />
            <button type="button" data-test="liste" aria-expanded="true">
              Rappel
            </button>
          </dccm-form-page>
        }
      `,
    })
    class Ecran {
      readonly ouverte = signal(false);
      readonly presentation = signal<DccmFormPagePresentation>('sheet');
    }

    async function ouvrir(presentation: DccmFormPagePresentation = 'sheet') {
      TestBed.configureTestingModule({
        providers: [
          { provide: InteractivityChecker, useValue: toujoursFocalisable },
        ],
      });
      const fixture = TestBed.createComponent(Ecran);
      fixture.componentInstance.presentation.set(presentation);
      const el = fixture.nativeElement as HTMLElement;
      document.body.appendChild(el);
      await fixture.whenStable();

      const declencheur = el.querySelector(
        '[data-test="declencheur"]',
      ) as HTMLButtonElement;
      declencheur.focus();
      declencheur.click();
      await fixture.whenStable();

      const feuille = () =>
        el.querySelector('dccm-form-page') as HTMLElement | null;
      return { fixture, el, declencheur, feuille };
    }

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('est un dialogue modal, nommé par son titre', async () => {
      const { feuille } = await ouvrir();

      expect(feuille()?.getAttribute('role')).toBe('dialog');
      expect(feuille()?.getAttribute('aria-modal')).toBe('true');
      expect(
        document.getElementById(
          feuille()?.getAttribute('aria-labelledby') ?? '',
        )?.textContent,
      ).toContain('Nouvel événement');
    });

    it('prend le focus à son ouverture, et le garde à la tabulation', async () => {
      const { feuille } = await ouvrir();
      const fermer = feuille()?.querySelector(
        'button[aria-label="Fermer"]',
      ) as HTMLButtonElement;
      const creer = [...(feuille()?.querySelectorAll('button') ?? [])].find(
        (bouton) => bouton.textContent?.trim() === "Créer l'événement",
      ) as HTMLButtonElement;

      expect(document.activeElement).toBe(fermer);

      // Les ancres du piège, de part et d'autre de la feuille : la tabulation
      // qui en sort y revient par l'autre bout.
      const [avant, apres] = [
        ...document.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor'),
      ];
      apres.focus();
      expect(document.activeElement).toBe(fermer);
      avant.focus();
      expect(document.activeElement).toBe(creer);
    });

    it('se ferme par Échap, et rend le focus à son déclencheur', async () => {
      const { fixture, declencheur, feuille } = await ouvrir();

      feuille()?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await fixture.whenStable();

      expect(feuille()).toBeNull();
      expect(document.activeElement).toBe(declencheur);
    });

    it("laisse Échap à la liste ouverte qu'elle contient", async () => {
      const { fixture, feuille } = await ouvrir();
      const liste = feuille()?.querySelector(
        '[data-test="liste"]',
      ) as HTMLElement;

      liste.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await fixture.whenStable();

      expect(feuille()).not.toBeNull();
    });

    it("ne piège rien en panneau, à côté d'une liste qui reste utilisable", async () => {
      const { feuille, declencheur } = await ouvrir('panel');

      expect(feuille()?.getAttribute('role')).toBe('region');
      expect(feuille()?.getAttribute('aria-modal')).toBeNull();
      expect(document.activeElement).toBe(declencheur);
      expect(document.querySelector('.cdk-focus-trap-anchor')).toBeNull();
    });
  });
});
