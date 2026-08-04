import { InjectionToken } from '@angular/core';

/**
 * Racine de l'API. Injectée plutôt que codée en dur : le tableau de bord est
 * servi depuis un autre hôte que l'API, et les tests la remplacent.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
