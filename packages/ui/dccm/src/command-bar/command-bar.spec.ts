import { InteractivityChecker } from '@angular/cdk/a11y';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  DccmCommandBar,
  DccmCommandBarTrigger,
  type DccmCommandFailure,
} from './command-bar';

// jsdom ne calcule aucune mise en page : tout élément y paraît invisible, et
// le piège de focus du CDK n'y trouverait rien à focaliser.
const atteignable = (element: HTMLElement) =>
  element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled;
const toujoursFocalisable: Partial<InteractivityChecker> = {
  isFocusable: atteignable,
  isTabbable: atteignable,
  isVisible: () => true,
  isDisabled: (element) => (element as HTMLButtonElement).disabled,
};

@Component({ template: '' })
class Ecran {}

@Component({
  imports: [DccmCommandBar, DccmCommandBarTrigger],
  template: `
    <button
      dccmCommandBarTrigger
      label="Que veux-tu faire ?"
      data-test="declencheur"
      (click)="barre.open()"
    ></button>
    <dccm-command-bar
      #barre
      [pending]="enCours()"
      [failure]="echec()"
      [error]="erreur()"
      (submitted)="commandes.push($event)"
      (closed)="fermetures = fermetures + 1"
    />
  `,
})
class Hote {
  readonly barre = viewChild.required(DccmCommandBar);
  readonly enCours = signal(false);
  readonly echec = signal<DccmCommandFailure | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly commandes: string[] = [];
  fermetures = 0;
}

const pause = () => new Promise((resolve) => setTimeout(resolve));

async function rendre() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'calendrier/evenements/nouveau', component: Ecran },
      ]),
      { provide: InteractivityChecker, useValue: toujoursFocalisable },
    ],
  });
  const fixture = TestBed.createComponent(Hote);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const stable = async () => {
    await fixture.whenStable();
    await pause();
    await fixture.whenStable();
  };
  const palette = () =>
    document.querySelector<HTMLElement>('[data-slot="command-bar-palette"]');
  const champ = () =>
    document.querySelector<HTMLInputElement>(
      '[data-slot="command-bar-palette"] input',
    );
  const raccourci = async (options: KeyboardEventInit) => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', bubbles: true, ...options }),
    );
    await stable();
  };
  const ouvrir = async () => {
    await raccourci({ ctrlKey: true });
    return palette() as HTMLElement;
  };
  const saisir = async (texte: string) => {
    const element = champ() as HTMLInputElement;
    element.value = texte;
    element.dispatchEvent(new Event('input'));
    await stable();
    element.form?.requestSubmit();
    await stable();
  };
  return { fixture, palette, champ, raccourci, ouvrir, saisir, stable };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DccmCommandBar', () => {
  it('s’ouvre par Ctrl+K, en dialogue, le champ prêt à la saisie', async () => {
    const { palette, champ, raccourci } = await rendre();
    expect(palette()).toBeNull();

    await raccourci({ ctrlKey: true });

    const dialogue = palette()?.closest('[role="dialog"]');
    expect(dialogue).not.toBeNull();
    expect(document.activeElement).toBe(champ());
    expect(champ()?.placeholder).toBe('Que veux-tu faire ?');
  });

  it('s’ouvre aussi par Cmd+K et par son déclencheur', async () => {
    const { fixture, palette, raccourci, stable } = await rendre();

    await raccourci({ metaKey: true });
    expect(palette()).not.toBeNull();
    fixture.componentInstance.barre().close();
    await stable();
    expect(palette()).toBeNull();

    (
      document.querySelector('[data-test="declencheur"]') as HTMLButtonElement
    ).click();
    await stable();
    expect(palette()).not.toBeNull();
  });

  it('ne s’ouvre pas sur K seul ni sur un autre raccourci', async () => {
    const { palette, raccourci } = await rendre();

    await raccourci({});
    await raccourci({ ctrlKey: true, shiftKey: true });
    await raccourci({ ctrlKey: true, key: 'j' });

    expect(palette()).toBeNull();
  });

  it('envoie la phrase telle qu’elle est écrite, jamais une phrase vide', async () => {
    const { fixture, ouvrir, saisir } = await rendre();
    await ouvrir();

    await saisir('   ');
    await saisir(' ajoute un dentiste jeudi à 9h30 ');

    expect(fixture.componentInstance.commandes).toEqual([
      ' ajoute un dentiste jeudi à 9h30 ',
    ]);
  });

  it('dit « Je cherche… » pendant la résolution, et n’envoie rien de plus', async () => {
    const { fixture, ouvrir, saisir, stable } = await rendre();
    const palette = await ouvrir();
    fixture.componentInstance.enCours.set(true);
    await stable();

    expect(palette.querySelector('[role="status"]')?.textContent).toContain(
      'Je cherche…',
    );
    await saisir('ajoute un dentiste');
    expect(fixture.componentInstance.commandes).toEqual([]);
  });

  it('dit franchement qu’elle ne sait pas, et propose l’écran le plus proche', async () => {
    const { fixture, ouvrir, palette, stable } = await rendre();
    await ouvrir();
    fixture.componentInstance.echec.set({
      nearestUrl: '/calendrier/evenements/nouveau',
    });
    await stable();

    const statut = palette()?.querySelector('[role="status"]');
    expect(statut?.textContent).toContain('Je ne sais pas encore faire ça.');
    const lien = statut?.querySelector('a') as HTMLAnchorElement;
    expect(lien.getAttribute('href')).toBe('/calendrier/evenements/nouveau');

    lien.click();
    await stable();
    expect(palette()).toBeNull();
  });

  it('sans écran proche, ne propose aucun lien', async () => {
    const { fixture, ouvrir, palette, stable } = await rendre();
    await ouvrir();
    fixture.componentInstance.echec.set({});
    await stable();

    const statut = palette()?.querySelector('[role="status"]');
    expect(statut?.textContent).toContain('Je ne sais pas encore faire ça.');
    expect(statut?.querySelector('a')).toBeNull();
  });

  it('affiche le message de l’API tel quel', async () => {
    const { fixture, ouvrir, palette, stable } = await rendre();
    await ouvrir();
    fixture.componentInstance.erreur.set('Le plafond mensuel de l’IA est atteint.');
    await stable();

    expect(palette()?.querySelector('[role="alert"]')?.textContent).toContain(
      'Le plafond mensuel de l’IA est atteint.',
    );
  });

  it('se ferme par Échap et par « Fermer », vidée, en le disant', async () => {
    const { fixture, ouvrir, champ, palette, stable } = await rendre();
    await ouvrir();
    const element = champ() as HTMLInputElement;
    element.value = 'ajoute';
    element.dispatchEvent(new Event('input'));
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    await stable();

    expect(palette()).toBeNull();
    expect(fixture.componentInstance.fermetures).toBe(1);

    await ouvrir();
    expect(champ()?.value).toBe('');
    (
      document.querySelector('[data-slot="command-bar-close"]') as HTMLButtonElement
    ).click();
    await stable();
    expect(palette()).toBeNull();
    expect(fixture.componentInstance.fermetures).toBe(2);
  });
});
