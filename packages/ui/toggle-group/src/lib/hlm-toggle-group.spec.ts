import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HlmToggleGroupImports } from '../index';

@Component({
  imports: [HlmToggleGroupImports, ReactiveFormsModule],
  template: `
    <hlm-toggle-group aria-label="Période" [formControl]="periode">
      <button hlmToggleGroupItem value="semaine">Semaine</button>
      <button hlmToggleGroupItem value="mois" [disabled]="moisDesactive()">
        Mois
      </button>
      <button hlmToggleGroupItem value="liste">Liste</button>
    </hlm-toggle-group>
  `,
})
class Hote {
  readonly periode = new FormControl('semaine');
  readonly moisDesactive = signal(false);
}

function rendre() {
  const fixture = TestBed.createComponent(Hote);
  fixture.detectChanges();
  const segments: HTMLButtonElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  );
  const actifs = () =>
    segments
      .filter((s) => s.getAttribute('aria-pressed') === 'true')
      .map((s) => s.textContent?.trim());
  const touche = (segment: HTMLElement, key: string) => {
    segment.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  };
  return { fixture, hote: fixture.componentInstance, segments, actifs, touche };
}

describe('HlmToggleGroup (SegmentedControl)', () => {
  it('a un seul segment actif, celui de la valeur', () => {
    const { actifs } = rendre();
    expect(actifs()).toEqual(['Semaine']);
  });

  it('un clic change de segment actif sans en laisser deux', () => {
    const { fixture, hote, segments, actifs } = rendre();
    segments[1].click();
    fixture.detectChanges();

    expect(actifs()).toEqual(['Mois']);
    expect(hote.periode.value).toBe('mois');
  });

  it('un clic sur le segment actif le laisse actif', () => {
    const { fixture, hote, segments, actifs } = rendre();
    segments[0].click();
    fixture.detectChanges();

    expect(actifs()).toEqual(['Semaine']);
    expect(hote.periode.value).toBe('semaine');
  });

  it('suit la valeur écrite dans le contrôle', () => {
    const { fixture, hote, actifs } = rendre();
    hote.periode.setValue('liste');
    fixture.detectChanges();

    expect(actifs()).toEqual(['Liste']);
  });

  it('ne laisse que le segment actif dans la tabulation', () => {
    const { segments } = rendre();
    expect(segments.map((s) => s.tabIndex)).toEqual([0, -1, -1]);
  });

  it('se pilote aux flèches : le segment suivant ou précédent devient actif et prend le focus', () => {
    const { hote, segments, actifs, touche } = rendre();
    segments[0].focus();

    touche(segments[0], 'ArrowRight');
    expect(actifs()).toEqual(['Mois']);
    expect(hote.periode.value).toBe('mois');
    expect(document.activeElement).toBe(segments[1]);
    expect(segments.map((s) => s.tabIndex)).toEqual([-1, 0, -1]);

    touche(segments[1], 'ArrowLeft');
    expect(actifs()).toEqual(['Semaine']);
    expect(document.activeElement).toBe(segments[0]);
  });

  it('boucle aux extrémités, et va au premier ou au dernier avec Début et Fin', () => {
    const { segments, actifs, touche } = rendre();

    touche(segments[0], 'ArrowLeft');
    expect(actifs()).toEqual(['Liste']);

    touche(segments[2], 'ArrowRight');
    expect(actifs()).toEqual(['Semaine']);

    touche(segments[0], 'End');
    expect(actifs()).toEqual(['Liste']);

    touche(segments[2], 'Home');
    expect(actifs()).toEqual(['Semaine']);
  });

  it('saute un segment désactivé', () => {
    const { fixture, hote, segments, actifs, touche } = rendre();
    hote.moisDesactive.set(true);
    fixture.detectChanges();

    touche(segments[0], 'ArrowRight');
    expect(actifs()).toEqual(['Liste']);
  });
});
