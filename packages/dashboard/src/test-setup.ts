import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

/**
 * jsdom n'implémente ni `ResizeObserver` ni `matchMedia`, dont les primitives
 * de spartan/ui se servent pour se positionner. Les remplacer par des doublures
 * inertes suffit : aucun test ne porte sur la géométrie, et sans elles le
 * composant lève avant même d'être rendu.
 */
class ObservateurInerte {
  observe(): void {
    /* rien à mesurer dans jsdom */
  }
  unobserve(): void {
    /* rien à mesurer dans jsdom */
  }
  disconnect(): void {
    /* rien à mesurer dans jsdom */
  }
}

globalThis.ResizeObserver ??= ObservateurInerte as never;
globalThis.IntersectionObserver ??= ObservateurInerte as never;

// jsdom ne fait défiler rien du tout : la surcouche du select appelle
// `scrollIntoView` pour amener l'option active sous les yeux.
Element.prototype.scrollIntoView ??= function scrollIntoView(): void {
  /* rien à faire défiler dans jsdom */
};

globalThis.matchMedia ??= ((requete: string) => ({
  matches: false,
  media: requete,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as never;
