import { InteractivityChecker } from '@angular/cdk/a11y';
import { ApplicationRef, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DccmConfirm, type DccmScope } from './confirm';

// jsdom ne calcule aucune mise en page : tout élément y paraît invisible, et
// le piège de focus du CDK n'y trouverait rien à focaliser. Ici, un élément
// est atteignable au clavier s'il est dans l'ordre de tabulation et actif.
const atteignable = (element: HTMLElement) =>
  element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled;
const toujoursFocalisable: Partial<InteractivityChecker> = {
  isFocusable: atteignable,
  isTabbable: atteignable,
  isVisible: () => true,
  isDisabled: (element) => (element as HTMLButtonElement).disabled,
};

@Component({
  template: `<button data-test="declencheur" (click)="ouvrir()">Clôturer</button>`,
})
class Ecran {
  private readonly _confirm = inject(DccmConfirm);
  choix: Promise<unknown> | undefined;
  forme: 'simple' | 'portee' = 'simple';

  ouvrir() {
    this.choix =
      this.forme === 'simple'
        ? this._confirm.confirm({
            title: 'Clôturer la liste de courses ?',
            description: 'Les articles cochés passent au stock.',
            confirmLabel: 'Clôturer la liste',
          })
        : this._confirm.chooseScope({
            title: "Modifier l'événement récurrent",
            confirmLabel: 'Valider la modification',
          });
  }
}

async function ouvrir(forme: Ecran['forme'] = 'simple') {
  TestBed.configureTestingModule({
    providers: [{ provide: InteractivityChecker, useValue: toujoursFocalisable }],
  });
  const fixture = TestBed.createComponent(Ecran);
  fixture.componentInstance.forme = forme;
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const declencheur = fixture.nativeElement.querySelector(
    '[data-test="declencheur"]',
  ) as HTMLButtonElement;
  declencheur.focus();
  declencheur.click();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  const dialogue = document.querySelector('[role="alertdialog"]') as HTMLElement;
  const bouton = (libelle: string) =>
    [...dialogue.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === libelle,
    ) as HTMLButtonElement;
  const fermeture = async () => {
    const choix = await fixture.componentInstance.choix;
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    return choix;
  };
  return { fixture, declencheur, dialogue, bouton, fermeture };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DccmConfirm', () => {
  it('ouvre un alertdialog nommé par son titre et renvoie la confirmation', async () => {
    const { dialogue, bouton, fermeture } = await ouvrir();

    const titre = document.getElementById(
      dialogue.getAttribute('aria-labelledby') ?? '',
    );
    expect(titre?.textContent).toContain('Clôturer la liste de courses ?');

    bouton('Clôturer la liste').click();

    expect(await fermeture()).toBe(true);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("renvoie null à l'annulation, par le bouton comme par Échap", async () => {
    const parBouton = await ouvrir();
    parBouton.bouton('Annuler').click();
    expect(await parBouton.fermeture()).toBeNull();

    document.body.innerHTML = '';
    TestBed.resetTestingModule();

    const parEchap = await ouvrir();
    parEchap.dialogue.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    expect(await parEchap.fermeture()).toBeNull();
  });

  it('piège le focus et le rend au déclencheur à la fermeture', async () => {
    const { declencheur, bouton, fermeture } = await ouvrir();

    // Le premier élément atteignable reçoit le focus à l'ouverture.
    expect(document.activeElement).toBe(bouton('Annuler'));

    // Tab après le dernier bouton atteint l'ancre de fin du piège, qui
    // renvoie au premier élément du dialogue ; Maj+Tab avant le premier
    // atteint l'ancre de début, qui renvoie au dernier.
    const ancres = [
      ...document.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor'),
    ];
    expect(ancres).toHaveLength(2);
    ancres[0].focus();
    expect(document.activeElement).toBe(bouton('Clôturer la liste'));
    ancres[1].focus();
    expect(document.activeElement).toBe(bouton('Annuler'));

    bouton('Annuler').click();
    await fermeture();

    expect(document.activeElement).toBe(declencheur);
  });

  it("pose le choix de portée sans option par défaut et renvoie l'option choisie", async () => {
    const { dialogue, bouton, fermeture } = await ouvrir('portee');

    const options = [
      ...dialogue.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    expect(options.map((o) => o.labels?.[0]?.textContent)).toEqual([
      expect.stringContaining('Cette occurrence uniquement'),
      expect.stringContaining('Toute la série'),
    ]);
    expect(options.some((o) => o.checked)).toBe(false);
    expect(bouton('Valider la modification').disabled).toBe(true);

    options[1].click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(bouton('Valider la modification').disabled).toBe(false);
    bouton('Valider la modification').click();

    expect(await fermeture()).toBe<DccmScope>('series');
  });
});
