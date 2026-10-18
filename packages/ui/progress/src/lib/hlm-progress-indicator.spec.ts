import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HlmProgress } from './hlm-progress';
import { HlmProgressIndicator } from './hlm-progress-indicator';

@Component({
  imports: [HlmProgress, HlmProgressIndicator],
  template: `
    <hlm-progress aria-label="Séances" [value]="value()" [max]="max()">
      <hlm-progress-indicator />
    </hlm-progress>
  `,
})
class Barre {
  readonly value = signal<number | null>(5);
  readonly max = signal(10);
}

async function rendre(value: number | null, max: number) {
  const fixture = TestBed.createComponent(Barre);
  fixture.componentInstance.value.set(value);
  fixture.componentInstance.max.set(max);
  await fixture.whenStable();
  const racine = fixture.nativeElement as HTMLElement;
  return {
    barre: racine.querySelector('hlm-progress') as HTMLElement,
    remplissage: racine.querySelector('hlm-progress-indicator') as HTMLElement,
  };
}

describe('HlmProgressIndicator', () => {
  it('remplit la part de la valeur sur le maximum, pas la valeur brute', async () => {
    const { barre, remplissage } = await rendre(5, 10);

    expect(remplissage.style.transform).toBe('translateX(-50%)');
    expect(barre.getAttribute('aria-valuenow')).toBe('5');
    expect(barre.getAttribute('aria-valuemax')).toBe('10');
    expect(barre.getAttribute('aria-valuetext')).toBe('50%');
  });

  it('remplit toute la piste quand la valeur atteint le maximum', async () => {
    const { remplissage } = await rendre(3, 3);

    expect(remplissage.style.transform).toBe('translateX(-0%)');
  });

  it('laisse la piste vide quand le maximum est nul', async () => {
    const { barre, remplissage } = await rendre(0, 0);

    expect(remplissage.style.transform).toBe('translateX(-100%)');
    // Le libellé par défaut de spartan divise 0 par 0 : « NaN% ».
    expect(barre.getAttribute('aria-valuetext')).toBe('0%');
  });
});

@Component({
  imports: [HlmProgress, HlmProgressIndicator],
  template: `
    <hlm-progress aria-label="Séances" [value]="3" [max]="4" [getValueLabel]="libelle">
      <hlm-progress-indicator />
    </hlm-progress>
  `,
})
class BarreLibellee {
  readonly libelle = (value: number, max: number) => `${value} séances sur ${max}`;
}

describe('HlmProgress', () => {
  it("annonce le libellé que l'écran lui donne", async () => {
    const fixture = TestBed.createComponent(BarreLibellee);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('hlm-progress')
        ?.getAttribute('aria-valuetext'),
    ).toBe('3 séances sur 4');
  });
});
