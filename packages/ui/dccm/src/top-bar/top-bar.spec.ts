import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DccmTopBar, type DccmScopeOption } from './top-bar';

@Component({
  imports: [DccmTopBar],
  template: `
    <dccm-top-bar
      [scopes]="espaces()"
      [(scope)]="espace"
      [userName]="nom()"
      (logout)="deconnexions = deconnexions + 1"
    >
      <span dccmTopBarSearch data-test="recherche">Recherche</span>
    </dccm-top-bar>
  `,
})
class Hote {
  readonly espaces = signal<DccmScopeOption[]>([
    { value: 'perso', label: 'Mon espace' },
    { value: 'foyer', label: 'Foyer' },
  ]);
  readonly espace = signal<string | null>('perso');
  readonly nom = signal<string | null>('Personne Admise');
  deconnexions = 0;
}

async function rendre() {
  const fixture = TestBed.createComponent(Hote);
  await fixture.whenStable();
  const racine = fixture.nativeElement as HTMLElement;
  const segments = () =>
    [
      ...racine.querySelectorAll<HTMLButtonElement>(
        '[data-slot="toggle-group-item"]',
      ),
    ];
  return { fixture, racine, segments };
}

describe('DccmTopBar', () => {
  it('propose un segment par Espace reçu, et rien de plus', async () => {
    const { fixture, segments } = await rendre();
    expect(segments().map((segment) => segment.textContent?.trim())).toEqual([
      'Mon espace',
      'Foyer',
    ]);

    fixture.componentInstance.espaces.set([
      { value: 'perso', label: 'Mon espace' },
    ]);
    await fixture.whenStable();

    expect(segments().map((segment) => segment.textContent?.trim())).toEqual([
      'Mon espace',
    ]);
  });

  it("retient l'Espace choisi", async () => {
    const { fixture, segments } = await rendre();

    segments()[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.espace()).toBe('foyer');
    expect(segments()[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('nomme le compte et en propose la déconnexion', async () => {
    const { fixture, racine } = await rendre();
    expect(racine.textContent).toContain('Personne Admise');

    (
      racine.querySelector('[data-slot="top-bar-logout"]') as HTMLButtonElement
    ).click();

    expect(fixture.componentInstance.deconnexions).toBe(1);
  });

  it('projette la zone de recherche', async () => {
    const { racine } = await rendre();

    expect(racine.querySelector('[data-test="recherche"]')).not.toBeNull();
  });

  it('ne montre ni compte ni sélecteur tant qu’ils sont inconnus', async () => {
    const { fixture, racine, segments } = await rendre();
    fixture.componentInstance.nom.set(null);
    fixture.componentInstance.espaces.set([]);
    await fixture.whenStable();

    expect(racine.querySelector('[data-slot="top-bar-logout"]')).toBeNull();
    expect(segments()).toEqual([]);
  });
});
