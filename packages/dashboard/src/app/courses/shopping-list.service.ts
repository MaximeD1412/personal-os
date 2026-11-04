import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ShoppingGap,
  ShoppingList,
  ShoppingListItem,
  ShoppingListItemInput,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Les Listes de courses ouvertes, les plus récentes d'abord. À demander dans
   * un contexte d'injection : la lecture vit et s'arrête avec l'écran.
   */
  ouvertes(): HttpResourceRef<ShoppingList[]> {
    return httpResource<ShoppingList[]>(
      () => ({
        url: `${this.baseUrl}/shopping-lists`,
        params: { status: 'OPEN' },
      }),
      { defaultValue: [] },
    );
  }

  /** Une liste ; rien n'est lu tant que l'identifiant est vide. */
  liste(id: () => string | null): HttpResourceRef<ShoppingList | undefined> {
    return httpResource<ShoppingList>(() => {
      const actuel = id();
      return actuel ? `${this.baseUrl}/shopping-lists/${actuel}` : undefined;
    });
  }

  /** Fige une liste depuis un planning arrêté. */
  produire(planId: string): Observable<ShoppingList> {
    return this.http.post<ShoppingList>(
      `${this.baseUrl}/meal-plans/${planId}/shopping-lists`,
      {},
    );
  }

  /**
   * Une liste de complément : les seuls Ingrédients qui manquent aux listes
   * déjà produites pour ce planning arrêté.
   */
  produireLeComplement(planId: string): Observable<ShoppingList> {
    return this.http.post<ShoppingList>(
      `${this.baseUrl}/meal-plans/${planId}/shopping-lists`,
      {},
      { params: { complement: true } },
    );
  }

  /**
   * L'écart entre un planning et ses listes figées ; rien n'est lu sans
   * planning. Chaque nouvelle valeur du planning relit l'écart : un repas a pu
   * changer.
   */
  ecart(
    planning: () => { id: string } | null,
  ): HttpResourceRef<ShoppingGap | undefined> {
    return httpResource<ShoppingGap>(() => {
      const actuel = planning();
      return actuel
        ? `${this.baseUrl}/meal-plans/${actuel.id}/shopping-gap`
        : undefined;
    });
  }

  ajouter(
    listeId: string,
    saisie: ShoppingListItemInput,
  ): Observable<ShoppingListItem> {
    return this.http.post<ShoppingListItem>(
      `${this.baseUrl}/shopping-lists/${listeId}/items`,
      saisie,
    );
  }

  /** Coche l'article, ou le décoche. */
  cocher(
    listeId: string,
    articleId: string,
    coche: boolean,
  ): Observable<ShoppingListItem> {
    return this.http.post<ShoppingListItem>(
      `${this.baseUrl}/shopping-lists/${listeId}/items/${articleId}/${coche ? 'check' : 'uncheck'}`,
      {},
    );
  }

  /** Retire un ajout manuel. */
  retirer(listeId: string, articleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/shopping-lists/${listeId}/items/${articleId}`,
    );
  }
}
