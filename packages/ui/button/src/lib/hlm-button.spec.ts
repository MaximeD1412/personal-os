import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HlmButton } from './hlm-button';

@Component({
  imports: [HlmButton],
  template: `
    <button
      hlmBtn
      [loading]="enCours()"
      [disabled]="desactive()"
      (click)="clics = clics + 1"
    >
      Enregistrer
    </button>
    <a hlmBtn href="/ailleurs" [loading]="enCours()">Ouvrir</a>
  `,
})
class Hote {
  readonly enCours = signal(false);
  readonly desactive = signal(false);
  clics = 0;
}

function rendre() {
  const fixture = TestBed.createComponent(Hote);
  fixture.detectChanges();
  const bouton: HTMLButtonElement =
    fixture.nativeElement.querySelector('button');
  const lien: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
  return { fixture, hote: fixture.componentInstance, bouton, lien };
}

describe('HlmButton', () => {
  it('pendant le chargement, se désactive et annonce son occupation', () => {
    const { fixture, hote, bouton } = rendre();
    expect(bouton.disabled).toBe(false);

    hote.enCours.set(true);
    fixture.detectChanges();

    expect(bouton.disabled).toBe(true);
    expect(bouton.getAttribute('aria-busy')).toBe('true');
    expect(bouton.querySelector('[data-slot=spinner]')).not.toBeNull();
  });

  it('se réactive à la fin du chargement', () => {
    const { fixture, hote, bouton } = rendre();
    hote.enCours.set(true);
    fixture.detectChanges();
    hote.enCours.set(false);
    fixture.detectChanges();

    expect(bouton.disabled).toBe(false);
    expect(bouton.hasAttribute('aria-busy')).toBe(false);
    expect(bouton.querySelector('[data-slot=spinner]')).toBeNull();
  });

  it('reste désactivé à la fin du chargement quand il l’était déjà', () => {
    const { fixture, hote, bouton } = rendre();
    hote.desactive.set(true);
    hote.enCours.set(true);
    fixture.detectChanges();
    hote.enCours.set(false);
    fixture.detectChanges();

    expect(bouton.disabled).toBe(true);
  });

  it('un lien en chargement ne navigue pas et sort de la tabulation', () => {
    const { fixture, hote, lien } = rendre();
    hote.enCours.set(true);
    fixture.detectChanges();

    const clic = new MouseEvent('click', { cancelable: true, bubbles: true });
    lien.dispatchEvent(clic);

    expect(clic.defaultPrevented).toBe(true);
    expect(lien.getAttribute('aria-disabled')).toBe('true');
    expect(lien.getAttribute('tabindex')).toBe('-1');
  });
});
