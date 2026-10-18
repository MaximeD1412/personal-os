import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DccmStepper } from './stepper';

@Component({
  imports: [DccmStepper, ReactiveFormsModule],
  template: `
    <dccm-stepper
      aria-label="Quantité"
      unit="g"
      [min]="1"
      [max]="3"
      [formControl]="quantite"
    />
  `,
})
class Hote {
  readonly quantite = new FormControl(2);
}

function rendre() {
  const fixture = TestBed.createComponent(Hote);
  fixture.detectChanges();
  const racine: HTMLElement = fixture.nativeElement;
  const trouver = <T extends HTMLElement>(selecteur: string): T => {
    const element = racine.querySelector<T>(selecteur);
    if (!element) throw new Error(`Introuvable : ${selecteur}`);
    return element;
  };
  const moins = trouver<HTMLButtonElement>('button[aria-label="Diminuer"]');
  const plus = trouver<HTMLButtonElement>('button[aria-label="Augmenter"]');
  const valeur = trouver('[role=spinbutton]');
  const cliquer = (bouton: HTMLButtonElement) => {
    bouton.click();
    fixture.detectChanges();
  };
  const touche = (key: string) => {
    valeur.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  };
  return {
    fixture,
    hote: fixture.componentInstance,
    moins,
    plus,
    valeur,
    cliquer,
    touche,
  };
}

describe('DccmStepper', () => {
  it('affiche la valeur du contrôle et son unité', () => {
    const { valeur } = rendre();
    expect(valeur.textContent?.trim()).toBe('2 g');
    expect(valeur.getAttribute('aria-valuenow')).toBe('2');
    expect(valeur.getAttribute('aria-valuetext')).toBe('2 g');
    expect(valeur.getAttribute('aria-label')).toBe('Quantité');
  });

  it('écrit dans le FormControl à chaque pas', () => {
    const { hote, moins, plus, cliquer } = rendre();
    cliquer(plus);
    expect(hote.quantite.value).toBe(3);
    cliquer(moins);
    cliquer(moins);
    expect(hote.quantite.value).toBe(1);
    expect(hote.quantite.dirty).toBe(true);
  });

  it('ne dépasse pas le maximum : le bouton + se désactive', () => {
    const { hote, plus, cliquer } = rendre();
    cliquer(plus);
    expect(plus.disabled).toBe(true);
    cliquer(plus);
    expect(hote.quantite.value).toBe(3);
  });

  it('ne descend pas sous le minimum : le bouton − se désactive', () => {
    const { hote, moins, cliquer } = rendre();
    cliquer(moins);
    expect(moins.disabled).toBe(true);
    cliquer(moins);
    expect(hote.quantite.value).toBe(1);
  });

  it('suit la valeur écrite dans le contrôle', () => {
    const { fixture, hote, valeur, plus } = rendre();
    hote.quantite.setValue(3);
    fixture.detectChanges();
    expect(valeur.textContent?.trim()).toBe('3 g');
    expect(plus.disabled).toBe(true);
  });

  it('se désactive avec le contrôle', () => {
    const { fixture, hote, moins, plus, valeur } = rendre();
    hote.quantite.disable();
    fixture.detectChanges();
    expect([moins.disabled, plus.disabled]).toEqual([true, true]);
    expect(valeur.getAttribute('aria-disabled')).toBe('true');
  });

  it('se pilote au clavier, dans les bornes', () => {
    const { hote, touche } = rendre();
    touche('ArrowUp');
    expect(hote.quantite.value).toBe(3);
    touche('ArrowUp');
    expect(hote.quantite.value).toBe(3);
    touche('Home');
    expect(hote.quantite.value).toBe(1);
    touche('End');
    expect(hote.quantite.value).toBe(3);
    touche('ArrowDown');
    expect(hote.quantite.value).toBe(2);
  });

  it('marque le contrôle touché quand il perd le focus', () => {
    const { hote, valeur } = rendre();
    valeur.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(hote.quantite.touched).toBe(true);
  });
});
