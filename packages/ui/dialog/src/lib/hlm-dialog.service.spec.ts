import { Component, inject, type TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { HlmDialogService } from './hlm-dialog.service';

@Component({ template: `<p data-test="composant">Contenu d'un composant</p>` })
class ContenuComposant {}

@Component({
  template: `
    <ng-template #modele let-ref>
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
});
