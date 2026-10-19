import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DccmFormPage, type DccmFormPagePresentation } from './form-page';

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

      const region = el.querySelector('[role="region"]') as HTMLElement;
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
});
