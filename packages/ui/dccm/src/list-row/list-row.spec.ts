import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DccmListRow } from './list-row';

@Component({
  imports: [DccmListRow],
  template: `
    <dccm-list-row
      data-test="case"
      label="Œufs bio plein air"
      meta="Réfrigérateur • 6 unités"
      checkable
      [(checked)]="coche"
      (checkedChange)="bascules.push($event)"
    />
    <button
      dccmListRow
      data-test="bouton"
      label="Crème fraîche"
      chevron
      (click)="clics = clics + 1"
    ></button>
    <a dccmListRow data-test="lien" href="/stock/1" label="Lait" selected></a>
  `,
})
class Lignes {
  readonly coche = signal(false);
  readonly bascules: boolean[] = [];
  clics = 0;
}

async function rendre() {
  const fixture = TestBed.createComponent(Lignes);
  await fixture.whenStable();
  const ligne = (nom: string) =>
    fixture.nativeElement.querySelector(
      `[data-test="${nom}"]`,
    ) as HTMLElement;
  const caseACocher = () =>
    ligne('case').querySelector('[role="checkbox"]') as HTMLButtonElement;
  return { fixture, ligne, caseACocher };
}

describe('DccmListRow', () => {
  it('émet la bascule de la case et barre le titre', async () => {
    const { fixture, ligne, caseACocher } = await rendre();

    caseACocher().click();
    await fixture.whenStable();

    expect(fixture.componentInstance.bascules).toEqual([true]);
    expect(fixture.componentInstance.coche()).toBe(true);
    expect(ligne('case').dataset['checked']).toBe('true');
    expect(caseACocher().getAttribute('aria-checked')).toBe('true');
    expect(
      ligne('case').querySelector('[data-slot="list-row-title"]')?.className,
    ).toContain('line-through');

    caseACocher().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.bascules).toEqual([true, false]);
    expect(ligne('case').dataset['checked']).toBeUndefined();
  });

  it('bascule aussi au clic sur le titre', async () => {
    const { fixture, ligne } = await rendre();

    (
      ligne('case').querySelector('[data-slot="list-row-title"]') as HTMLElement
    ).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.bascules).toEqual([true]);
  });

  it('suit la valeur que lui donne le parent', async () => {
    const { fixture, ligne, caseACocher } = await rendre();

    fixture.componentInstance.coche.set(true);
    await fixture.whenStable();

    expect(ligne('case').dataset['checked']).toBe('true');
    expect(caseACocher().getAttribute('aria-checked')).toBe('true');
  });

  it('reste utilisable au clavier : la case est un bouton natif, nommé par le titre', async () => {
    const { ligne, caseACocher } = await rendre();
    const caseNative = caseACocher();

    // Un `<button>` reçoit le focus à la tabulation, et Espace ou Entrée le
    // cliquent : la bascule au clavier est celle du clic.
    expect(caseNative.tagName).toBe('BUTTON');
    expect(caseNative.tabIndex).toBe(0);
    caseNative.focus();
    expect(document.activeElement).toBe(caseNative);

    const titre = document.getElementById(
      caseNative.getAttribute('aria-labelledby') ?? '',
    );
    expect(titre?.textContent?.trim()).toBe('Œufs bio plein air');
    expect(ligne('case').textContent).toContain('Réfrigérateur • 6 unités');
  });

  it('se pose sur un bouton ou un lien, qui restent les éléments interactifs', async () => {
    const { fixture, ligne } = await rendre();

    ligne('bouton').click();
    expect(fixture.componentInstance.clics).toBe(1);
    expect(ligne('bouton').querySelector('[role="checkbox"]')).toBeNull();
    expect(ligne('bouton').querySelector('ng-icon')).not.toBeNull();

    expect(ligne('lien').getAttribute('href')).toBe('/stock/1');
    expect(ligne('lien').dataset['selected']).toBe('true');
    expect(ligne('lien').textContent?.trim()).toBe('Lait');
  });
});
