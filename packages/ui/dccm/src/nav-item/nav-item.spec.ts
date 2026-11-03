import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';
import { matAccountBalanceWalletOutline } from '@ng-icons/material-symbols/outline';
import { DccmNavItem } from './nav-item';

@Component({
  imports: [DccmNavItem],
  viewProviders: [provideIcons({ matAccountBalanceWalletOutline })],
  template: `
    <a dccmNavItem data-test="lien" href="/agenda" icon="matAccountBalanceWalletOutline" label="Agenda" active></a>
    <span dccmNavItem data-test="bientot" icon="matAccountBalanceWalletOutline" label="Finances" comingSoon></span>
    <span dccmNavItem data-test="rail" icon="matAccountBalanceWalletOutline" label="Finances" comingSoon compact></span>
  `,
})
class Entrees {}

async function rendre() {
  const fixture = TestBed.createComponent(Entrees);
  await fixture.whenStable();
  return (nom: string) =>
    fixture.nativeElement.querySelector(`[data-test="${nom}"]`) as HTMLElement;
}

describe('DccmNavItem', () => {
  it('dit « À venir » et ne se rend pas atteignable', async () => {
    const entree = (await rendre())('bientot');

    expect(entree.textContent).toContain('Finances');
    expect(entree.textContent).toContain('À venir');
    expect(entree.getAttribute('aria-disabled')).toBe('true');
    expect(entree.hasAttribute('href')).toBe(false);
    expect(entree.hasAttribute('tabindex')).toBe(false);
  });

  it('garde son nom pour les lecteurs d’écran en mode compact', async () => {
    const entree = (await rendre())('rail');

    expect(entree.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Finances (à venir)',
    );
    expect(entree.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it('marque l’entrée active', async () => {
    const entree = (await rendre())('lien');

    expect(entree.dataset['active']).toBe('true');
    expect(entree.querySelector('[data-slot="badge"]')).toBeNull();
  });
});
