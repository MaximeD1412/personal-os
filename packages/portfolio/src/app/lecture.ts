import { HttpErrorResponse, type HttpResourceRef } from '@angular/common/http';
import { computed, type Signal } from '@angular/core';
import type { ApiError } from '@personal-os/contracts';

/**
 * L'état d'une lecture publique. Un 404 n'est pas une panne : c'est un
 * contenu absent de cette langue, qui ne s'affiche donc pas, et que rien ne
 * remplace (ADR 0019).
 */
export type Lecture<T> =
  | { readonly etat: 'chargement' }
  | { readonly etat: 'absent' }
  | { readonly etat: 'erreur'; readonly message: string }
  | { readonly etat: 'present'; readonly valeur: T };

export function lire<T>(
  ressource: HttpResourceRef<T | undefined>,
): Signal<Lecture<T>> {
  return computed(() => {
    const erreur = ressource.error();
    if (erreur) {
      if (erreur instanceof HttpErrorResponse && erreur.status === 404) {
        return { etat: 'absent' };
      }
      return { etat: 'erreur', message: messageDe(erreur) };
    }
    if (ressource.isLoading() || !ressource.hasValue()) {
      return { etat: 'chargement' };
    }
    return { etat: 'present', valeur: ressource.value() as T };
  });
}

/**
 * Le `message` de l'API, jamais un message de remplacement. Seul un corps qui
 * n'est pas son enveloppe (un proxy qui répond à sa place) reçoit le message
 * réseau. L'enveloppe se lit sans zod : le portfolio public reste léger.
 */
function messageDe(erreur: unknown): string {
  if (erreur instanceof HttpErrorResponse) {
    return estUneEnveloppe(erreur.error)
      ? erreur.error.message
      : "Le serveur n'a pas répondu.";
  }
  return erreur instanceof Error ? erreur.message : String(erreur);
}

function estUneEnveloppe(corps: unknown): corps is ApiError {
  return (
    typeof corps === 'object' &&
    corps !== null &&
    typeof (corps as Partial<ApiError>).message === 'string' &&
    typeof (corps as Partial<ApiError>).code === 'string'
  );
}
