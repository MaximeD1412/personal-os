import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';
import {
  matCalendarTodayOutline,
  matDashboardOutline,
  matMoreHorizOutline,
} from '@ng-icons/material-symbols/outline';
import { provideRouter, Router } from '@angular/router';
import { DccmTabBar, DccmTabBarItem } from './tab-bar';

@Component({ template: '' })
class Ecran {}

@Component({
  imports: [DccmTabBar, DccmTabBarItem],
  viewProviders: [
    provideIcons({
      matDashboardOutline,
      matCalendarTodayOutline,
      matMoreHorizOutline,
    }),
  ],
  template: `
    <dccm-tab-bar [entries]="onglets">
      <button dccmTabBarItem type="button" icon="matMoreHorizOutline" label="Plus"></button>
    </dccm-tab-bar>
  `,
})
class Hote {
  readonly onglets = [
    { label: 'Accueil', icon: 'matDashboardOutline', comingSoon: true },
    { label: 'Agenda', icon: 'matCalendarTodayOutline', link: '/agenda' },
  ];
}

async function rendre() {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'agenda', component: Ecran }])],
  });
  const fixture = TestBed.createComponent(Hote);
  await TestBed.inject(Router).navigateByUrl('/agenda');
  await fixture.whenStable();
  const racine = fixture.nativeElement as HTMLElement;
  const onglet = (libelle: string) =>
    [
      ...racine.querySelectorAll<HTMLElement>('[data-slot="tab-bar-item"]'),
    ].find((element) => element.textContent?.includes(libelle)) as HTMLElement;
  return { onglet };
}

describe('DccmTabBar', () => {
  it("mène à l'écran de chaque onglet et marque celui de la page", async () => {
    const { onglet } = await rendre();

    expect(onglet('Agenda').getAttribute('href')).toBe('/agenda');
    expect(onglet('Agenda').getAttribute('aria-current')).toBe('page');
  });

  it("n'offre rien à cliquer pour un onglet à venir", async () => {
    const { onglet } = await rendre();

    expect(onglet('Accueil').tagName).toBe('SPAN');
    expect(onglet('Accueil').getAttribute('aria-disabled')).toBe('true');
    expect(onglet('Accueil').textContent).toContain('(à venir)');
  });

  it('accueille un onglet projeté, comme « Plus »', async () => {
    const { onglet } = await rendre();

    expect(onglet('Plus').tagName).toBe('BUTTON');
  });
});
