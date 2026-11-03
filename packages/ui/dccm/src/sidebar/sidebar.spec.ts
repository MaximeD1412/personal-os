import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';
import {
  matCalendarMonthOutline,
  matHelpOutline,
  matHomeOutline,
} from '@ng-icons/material-symbols/outline';
import { provideRouter, Router } from '@angular/router';
import type { DccmNavGroup } from '../nav-item/nav-item';
import { DccmSidebar, type DccmSidebarVariant } from './sidebar';

@Component({ template: '' })
class Ecran {}

const GROUPES: DccmNavGroup[] = [
  {
    label: 'Organisation',
    entries: [
      { label: 'Accueil', icon: 'matHomeOutline', link: '/' },
      { label: 'Calendrier', icon: 'matCalendarMonthOutline', link: '/calendrier' },
    ],
  },
  {
    label: 'Gestion',
    entries: [{ label: 'Finances', icon: 'matHomeOutline', comingSoon: true }],
  },
];

@Component({
  imports: [DccmSidebar],
  viewProviders: [
    provideIcons({ matHomeOutline, matCalendarMonthOutline, matHelpOutline }),
  ],
  template: `
    <dccm-sidebar
      [groups]="groupes"
      [footer]="pied"
      [variant]="variante()"
      [status]="{ label: 'API joignable', tone: 'success' }"
      (navigate)="navigations = navigations + 1"
    />
  `,
})
class Hote {
  readonly groupes = GROUPES;
  readonly pied = [{ label: 'Aide et support', icon: 'matHelpOutline' }];
  readonly variante = signal<DccmSidebarVariant>('full');
  navigations = 0;
}

async function rendre() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Ecran },
        { path: 'calendrier', component: Ecran },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(Hote);
  await TestBed.inject(Router).navigateByUrl('/calendrier');
  await fixture.whenStable();
  const racine = fixture.nativeElement as HTMLElement;
  const entree = (libelle: string) =>
    [...racine.querySelectorAll<HTMLElement>('[data-slot="nav-item"]')].find(
      (element) => element.textContent?.includes(libelle),
    ) as HTMLElement;
  return { fixture, racine, entree };
}

describe('DccmSidebar', () => {
  it('nomme ses groupes et en fait des listes', async () => {
    const { racine } = await rendre();

    const listes = [...racine.querySelectorAll('ul[aria-labelledby]')].map(
      (liste) =>
        racine
          .querySelector(`#${liste.getAttribute('aria-labelledby')}`)
          ?.textContent?.trim(),
    );
    expect(listes).toEqual(['Organisation', 'Gestion']);
  });

  it('fait un lien de chaque entrée atteignable et marque celle de la page', async () => {
    const { entree } = await rendre();

    expect(entree('Calendrier').getAttribute('href')).toBe('/calendrier');
    expect(entree('Calendrier').getAttribute('aria-current')).toBe('page');
    expect(entree('Accueil').getAttribute('href')).toBe('/');
    expect(entree('Accueil').hasAttribute('aria-current')).toBe(false);
  });

  it("n'offre rien à cliquer pour une entrée à venir ou sans chemin", async () => {
    const { entree } = await rendre();

    expect(entree('Finances').tagName).toBe('SPAN');
    expect(entree('Finances').textContent).toContain('À venir');
    expect(entree('Aide et support').tagName).toBe('SPAN');
  });

  it('signale une navigation, pour qu’un panneau se referme', async () => {
    const { fixture, entree } = await rendre();

    entree('Accueil').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.navigations).toBe(1);
  });

  it("dit l'état de l'API au pied, même en rail", async () => {
    const { fixture, racine, entree } = await rendre();
    fixture.componentInstance.variante.set('rail');
    await fixture.whenStable();

    expect(racine.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'API joignable',
    );
    expect(entree('Calendrier').dataset['active']).toBe('true');
    expect(entree('Calendrier').querySelector('.sr-only')?.textContent).toBe(
      'Calendrier',
    );
  });
});
