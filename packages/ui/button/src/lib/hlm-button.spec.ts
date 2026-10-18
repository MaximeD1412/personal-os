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
    <a
      hlmBtn
      href="/ailleurs"
      [loading]="enCours()"
      [disabled]="desactive()"
      (click)="clicsLien = clicsLien + 1"
      >Ouvrir</a
    >
  `,
})
class Hote {
  readonly enCours = signal(false);
  readonly desactive = signal(false);
  clics = 0;
  clicsLien = 0;
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

  it("un lien en chargement ou désactivé n'appelle pas son gestionnaire (click)", () => {
    const { fixture, hote, lien } = rendre();
    hote.enCours.set(true);
    fixture.detectChanges();
    lien.click();
    expect(hote.clicsLien).toBe(0);

    hote.enCours.set(false);
    hote.desactive.set(true);
    fixture.detectChanges();
    lien.click();
    expect(hote.clicsLien).toBe(0);

    hote.desactive.set(false);
    fixture.detectChanges();
    lien.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    expect(hote.clicsLien).toBe(1);
  });

  it('un bouton en chargement ou désactivé n’appelle pas son gestionnaire (click)', () => {
    const { fixture, hote, bouton } = rendre();
    hote.enCours.set(true);
    fixture.detectChanges();
    bouton.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    expect(hote.clics).toBe(0);
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

  it("rempli (secondary) en bouton d'icône, n'a pas la bordure du secondaire", () => {
    const fixture = TestBed.createComponent(BoutonIcone);
    fixture.detectChanges();
    const bouton: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(bouton.classList).toContain('border-transparent');
    expect(bouton.classList).not.toContain('border-surface-container-highest');
  });
});

@Component({
  imports: [HlmButton],
  template: `<button hlmBtn variant="secondary" size="icon" aria-label="Modifier"></button>`,
})
class BoutonIcone {}
