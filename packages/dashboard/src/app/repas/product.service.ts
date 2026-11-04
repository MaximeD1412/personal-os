import {
  HttpClient,
  httpResource,
  type HttpResourceRef,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  Ingredient,
  Product,
  ProductInput,
  ProductUpdate,
} from '@personal-os/contracts';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Les Produits d'un Ingrédient ; rien n'est lu tant que l'identifiant est vide. */
  produits(ingredientId: () => string | null): HttpResourceRef<Product[]> {
    return httpResource<Product[]>(
      () => {
        const actuel = ingredientId();
        return actuel
          ? `${this.baseUrl}/ingredients/${actuel}/products`
          : undefined;
      },
      { defaultValue: [] },
    );
  }

  creer(saisie: ProductInput): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/products`, saisie);
  }

  modifier(id: string, changements: ProductUpdate): Observable<Product> {
    return this.http.patch<Product>(
      `${this.baseUrl}/products/${id}`,
      changements,
    );
  }

  retirer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/${id}`);
  }

  /** Le Produit préféré de l'Ingrédient : l'un des siens, ou aucun. */
  preferer(
    ingredientId: string,
    productId: string | null,
  ): Observable<Ingredient> {
    return this.http.post<Ingredient>(
      `${this.baseUrl}/ingredients/${ingredientId}/preferred-product`,
      { productId },
    );
  }
}
