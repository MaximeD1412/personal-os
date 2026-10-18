import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matCheckCircleOutline } from '@ng-icons/material-symbols/outline';
import { HlmBadge, type BadgeTone } from './hlm-badge';

@Component({
  imports: [HlmBadge, NgIcon],
  viewProviders: [provideIcons({ matCheckCircleOutline })],
  template: `
    <span hlmBadge data-test="libelle" [tone]="tone()" dot>En attente</span>
    <span hlmBadge data-test="icone" tone="success">
      <ng-icon name="matCheckCircleOutline" />
    </span>
    <span hlmBadge data-test="vide" tone="error"></span>
    <span hlmBadge data-test="tag" variant="tag" accent>Sprint 42</span>
  `,
})
class Badges {
  readonly tone = signal<BadgeTone>('warning');
}

async function rendre() {
  const fixture = TestBed.createComponent(Badges);
  await fixture.whenStable();
  const badge = (nom: string) =>
    fixture.nativeElement.querySelector(
      `[data-test="${nom}"]`,
    ) as HTMLElement;
  return { fixture, badge };
}

describe('HlmBadge', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rend le libellé avec la tonalité, le point ne le remplace pas', async () => {
    const { badge } = await rendre();
    const libelle = badge('libelle');

    expect(libelle.textContent?.trim()).toBe('En attente');
    expect(libelle.dataset['tone']).toBe('warning');
    expect(libelle.dataset['dot']).toBe('true');
    expect(libelle.className).toContain('text-tertiary');
    // La taille de `label-micro` survit à la couleur du texte : les deux
    // classes s'écrivent `text-*`.
    expect(libelle.className).toContain('text-label-micro');
  });

  it("suit la tonalité quand elle change", async () => {
    const { fixture, badge } = await rendre();
    fixture.componentInstance.tone.set('error');
    await fixture.whenStable();

    expect(badge('libelle').dataset['tone']).toBe('error');
    expect(badge('libelle').className).toContain('text-error');
    expect(badge('libelle').className).not.toContain('text-tertiary');
  });

  it('accepte une icône à la place du libellé', async () => {
    const { badge } = await rendre();

    expect(badge('icone').querySelector('ng-icon')).not.toBeNull();
  });

  it('signale un badge qui ne porte que sa couleur', async () => {
    const erreur = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await rendre();

    expect(erreur).toHaveBeenCalledTimes(1);
    expect(erreur.mock.calls[0][0]).toContain('libellé ou une icône');
  });

  it('rend un tag, mot-clé au rayon 4, accentué en primary', async () => {
    const { badge } = await rendre();
    const tag = badge('tag');

    expect(tag.dataset['variant']).toBe('tag');
    expect(tag.className).toContain('rounded-sm');
    expect(tag.className).toContain('text-primary');
  });
});
