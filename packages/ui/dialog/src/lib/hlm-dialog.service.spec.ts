import { Component, inject, type TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { HlmDialogClose } from './hlm-dialog-close';
import { HlmDialogTitle } from './hlm-dialog-title';
import { HlmDialogService } from './hlm-dialog.service';

@Component({ template: `<p data-test="composant">Contenu d'un composant</p>` })
class ContenuComposant {}

@Component({
  imports: [HlmDialogTitle, HlmDialogClose],
  template: `
    <ng-template #modele let-ref>
      <h2 hlmDialogTitle data-test="titre">Renommer la recette</h2>
      <button hlmDialogClose data-test="annuler">Annuler</button>
      <p data-test="modele">Contenu d'un modèle</p>
      <button data-test="fermer" (click)="ref.close('fait')">Fermer</button>
    </ng-template>
  `,
})
class Ecran {
  readonly dialogues = inject(HlmDialogService);
  readonly modele = viewChild.required<TemplateRef<unknown>>('modele');
}

async function rendre() {
  const fixture = TestBed.createComponent(Ecran);
  await fixture.whenStable();
  return fixture;
}

async function stable(fixture: { whenStable(): Promise<unknown> }) {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('HlmDialogService', () => {
  it('rend un composant dans la modale', async () => {
    const fixture = await rendre();
    fixture.componentInstance.dialogues.open(ContenuComposant);
    await stable(fixture);

    expect(document.querySelector('[data-test="composant"]')).not.toBeNull();
  });

  it('rend un modèle dans la modale, qui reçoit la référence du dialogue', async () => {
    const fixture = await rendre();
    const ref: BrnDialogRef<string> = fixture.componentInstance.dialogues.open(
      fixture.componentInstance.modele(),
    );
    const fermeture = new Promise((resolve) => ref.closed$.subscribe(resolve));
    await stable(fixture);

    expect(document.querySelector('[data-test="modele"]')?.textContent).toContain(
      "Contenu d'un modèle",
    );
    (document.querySelector('[data-test="fermer"]') as HTMLButtonElement).click();
    expect(await fermeture).toBe('fait');
  });

  it('fournit le dialogue aux directives du modèle (titre, fermeture)', async () => {
    const fixture = await rendre();
    const ref: BrnDialogRef<string> = fixture.componentInstance.dialogues.open(
      fixture.componentInstance.modele(),
    );
    const fermeture = new Promise((resolve) => ref.closed$.subscribe(resolve));
    await stable(fixture);

    const titre = document.querySelector('[data-test="titre"]') as HTMLElement;
    const dialogue = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogue.getAttribute('aria-labelledby')).toBe(titre.id);

    (document.querySelector('[data-test="annuler"]') as HTMLButtonElement).click();
    expect(await fermeture).toBeUndefined();
  });
});
