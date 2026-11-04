import { httpResource, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, Component, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DccmState, stateOf, type DccmStateStatus } from './state';

@Component({
  imports: [DccmState],
  template: `
    <dccm-state
      [status]="status()"
      [error]="erreur()"
      emptyHeading="Aucune séance cette semaine"
      (retry)="relances = relances + 1"
    >
      <p data-test="contenu">Trois séances</p>
    </dccm-state>
  `,
})
class Ecran {
  readonly status = signal<DccmStateStatus>('loading');
  readonly erreur = signal<{ message: string } | null>(null);
  relances = 0;
}

async function rendre() {
  const fixture = TestBed.createComponent(Ecran);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el };
}

describe('DccmState', () => {
  it("annonce le chargement par un squelette, sans montrer le contenu", async () => {
    const { el } = await rendre();

    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(el.querySelector('[data-test="contenu"]')).toBeNull();
  });

  it("affiche le message de l'API et relance par « Réessayer »", async () => {
    const { fixture, el } = await rendre();
    fixture.componentInstance.status.set('error');
    fixture.componentInstance.erreur.set({
      message: "L'Espace demandé n'existe pas.",
    });
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      "L'Espace demandé n'existe pas.",
    );
    const reessayer = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Réessayer'),
    ) as HTMLButtonElement;
    reessayer.click();
    expect(fixture.componentInstance.relances).toBe(1);
  });

  it("montre l'état vide, puis le contenu une fois prêt", async () => {
    const { fixture, el } = await rendre();
    fixture.componentInstance.status.set('empty');
    await fixture.whenStable();
    expect(el.textContent).toContain('Aucune séance cette semaine');
    expect(el.querySelector('[data-test="contenu"]')).toBeNull();

    fixture.componentInstance.status.set('ready');
    await fixture.whenStable();
    expect(el.querySelector('[data-test="contenu"]')).not.toBeNull();
  });
});

describe('stateOf', () => {
  const ressource = (r: {
    status?: string;
    isLoading?: boolean;
    error?: Error;
    value?: string[];
  }) => ({
    status: () =>
      r.status ?? (r.error ? 'error' : r.isLoading ? 'loading' : 'resolved'),
    isLoading: () => r.isLoading ?? false,
    error: () => r.error,
    hasValue: () => r.value !== undefined,
    value: () => r.value,
  });
  const vide = (v: string[]) => v.length === 0;

  it("déduit l'état d'une lecture", () => {
    expect(stateOf(ressource({ isLoading: true }), vide)).toBe('loading');
    expect(stateOf(ressource({ error: new Error('Refusé') }), vide)).toBe('error');
    expect(stateOf(ressource({ value: [] }), vide)).toBe('empty');
    expect(stateOf(ressource({ value: ['a'] }), vide)).toBe('ready');
  });

  it('garde la valeur affichée pendant un rechargement', () => {
    expect(
      stateOf(
        ressource({ status: 'reloading', isLoading: true, value: ['a'] }),
        vide,
      ),
    ).toBe('ready');
  });

  it("ne prend pas la valeur par défaut d'une httpResource pour un résultat vide", async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const seances = httpResource<string[]>(() => '/api/training-sessions', {
      defaultValue: [],
      injector: TestBed.inject(Injector),
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();

    // `hasValue()` vaut déjà `true` : c'est la valeur par défaut, pas la réponse.
    expect(seances.hasValue()).toBe(true);
    expect(stateOf(seances, vide)).toBe('loading');

    http.expectOne('/api/training-sessions').flush([]);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(stateOf(seances, vide)).toBe('empty');

    seances.reload();
    TestBed.tick();
    expect(stateOf(seances, vide)).toBe('empty');
    http.expectOne('/api/training-sessions').flush(['a']);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(stateOf(seances, vide)).toBe('ready');
  });
});
