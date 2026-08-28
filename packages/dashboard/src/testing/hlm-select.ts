import type { ComponentFixture } from '@angular/core/testing';

/**
 * Piloter un `hlm-select` depuis un test.
 *
 * Il ne s'agit plus d'un `<select>` natif : le déclencheur est un bouton, et
 * les options vivent dans une surcouche CDK attachée au `body`, hors de
 * l'arbre du composant. On ne peut donc ni lire `.value` ni émettre un
 * `change` — il faut ouvrir, puis cliquer, comme le ferait quelqu'un.
 */

const DECLENCHEUR = '[data-slot="select-trigger"]';
const OPTION = '[data-slot="select-item"]';

function declencheur(
  fixture: ComponentFixture<unknown>,
  nom: string,
): HTMLButtonElement {
  const trouve = (fixture.nativeElement as HTMLElement).querySelector(
    `[data-test="${nom}"] ${DECLENCHEUR}`,
  );

  if (!trouve) {
    throw new Error(`Aucun hlm-select nommé « ${nom} » dans ce composant.`);
  }
  return trouve as HTMLButtonElement;
}

/** Ce que le déclencheur affiche — la valeur choisie, ou l'invite. */
export function valeurAffichee(
  fixture: ComponentFixture<unknown>,
  nom: string,
): string {
  return declencheur(fixture, nom).textContent?.trim() ?? '';
}

/** Ouvre la liste et rend les options, dans l'ordre où elles s'affichent. */
export async function ouvrirLeSelect(
  fixture: ComponentFixture<unknown>,
  nom: string,
): Promise<HTMLElement[]> {
  declencheur(fixture, nom).click();
  await fixture.whenStable();
  fixture.detectChanges();

  // La surcouche est posée sur le `body`, pas dans le composant.
  return [...document.querySelectorAll<HTMLElement>(OPTION)];
}

/** Les libellés offerts, l'un après l'autre. */
export async function optionsOffertes(
  fixture: ComponentFixture<unknown>,
  nom: string,
): Promise<string[]> {
  const options = await ouvrirLeSelect(fixture, nom);
  const libelles = options.map((option) => option.textContent?.trim() ?? '');

  await fermer(fixture);
  return libelles;
}

/** Ouvre la liste et choisit l'option portant ce libellé. */
export async function choisirDansLeSelect(
  fixture: ComponentFixture<unknown>,
  nom: string,
  libelle: string,
): Promise<void> {
  const options = await ouvrirLeSelect(fixture, nom);
  const voulue = options.find(
    (option) => option.textContent?.trim() === libelle,
  );

  if (!voulue) {
    const offertes = options.map((option) => option.textContent?.trim());
    throw new Error(
      `« ${libelle} » n'est pas offert par « ${nom} » : ${offertes.join(', ')}.`,
    );
  }

  voulue.click();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** Referme la liste en cliquant hors d'elle. */
async function fermer(fixture: ComponentFixture<unknown>): Promise<void> {
  const voile = document.querySelector<HTMLElement>('.cdk-overlay-backdrop');
  voile?.click();

  await fixture.whenStable();
  fixture.detectChanges();
}
