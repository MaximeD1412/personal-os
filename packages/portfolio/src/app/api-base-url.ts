import { InjectionToken } from '@angular/core';

/** La racine de l'API, servie sous la même origine que le portfolio. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
