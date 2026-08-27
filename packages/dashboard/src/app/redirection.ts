import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Redirection {
  vers(url: string): void {
    window.location.assign(url);
  }
}
